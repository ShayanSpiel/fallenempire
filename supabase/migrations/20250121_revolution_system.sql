-- Revolution & Uprising System
-- Implements the complete rebellion mechanics with agitation, battle, and negotiation phases
-- Includes separate civil_wars table for future customization

-- ============================================================================
-- 1. REBELLIONS TABLE - Core uprising tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rebellions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- The spark who started it
  target_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- The current Governor/Sovereign

  -- Status progression: spark -> agitation -> battle -> success/failed/negotiated
  status TEXT NOT NULL DEFAULT 'agitation'
    CHECK (status IN ('agitation', 'battle', 'success', 'failed', 'negotiated')),

  -- Progress tracking for agitation phase
  current_supports INTEGER NOT NULL DEFAULT 1,
  required_supports INTEGER NOT NULL DEFAULT 5, -- Calculated as 20% of community, excluding governor

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agitation_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  battle_started_at TIMESTAMPTZ,

  -- Exile mechanic
  is_leader_exiled BOOLEAN DEFAULT FALSE,
  exiled_at TIMESTAMPTZ,

  -- Cooldown tracking
  cooldown_until TIMESTAMPTZ,
  cooldown_type TEXT CHECK (cooldown_type IN ('exile', 'failure', 'negotiation')),

  CONSTRAINT valid_required_supports CHECK (required_supports > 0)
);

-- Partial unique index: only one active rebellion per community
-- (Ensures community can only have one 'agitation' or 'battle' rebellion at a time)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_rebellion_per_community
  ON public.rebellions(community_id, status)
  WHERE status IN ('agitation', 'battle');

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rebellions_community_status
  ON public.rebellions(community_id, status);
CREATE INDEX IF NOT EXISTS idx_rebellions_leader
  ON public.rebellions(leader_id);
CREATE INDEX IF NOT EXISTS idx_rebellions_target
  ON public.rebellions(target_id);
CREATE INDEX IF NOT EXISTS idx_rebellions_cooldown
  ON public.rebellions(community_id, cooldown_until)
  WHERE status IN ('agitation', 'battle');

-- Enable Realtime for live progress bar updates
ALTER TABLE public.rebellions REPLICA IDENTITY FULL;

-- ============================================================================
-- 2. REBELLION_SUPPORTS TABLE - Track individual supporters
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rebellion_supports (
  rebellion_id UUID NOT NULL REFERENCES public.rebellions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (rebellion_id, user_id)
);

-- Index for counting supporters
CREATE INDEX IF NOT EXISTS idx_rebellion_supports_count
  ON public.rebellion_supports(rebellion_id);

-- Enable Realtime
ALTER TABLE public.rebellion_supports REPLICA IDENTITY FULL;

-- ============================================================================
-- 3. CIVIL_WARS TABLE - Separate from regular battles for customization
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.civil_wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebellion_id UUID NOT NULL REFERENCES public.rebellions(id) ON DELETE CASCADE,

  -- Combatants
  attacker_community_id UUID NOT NULL REFERENCES public.communities(id),
  defender_community_id UUID NOT NULL REFERENCES public.communities(id),
  leader_id UUID REFERENCES public.users(id), -- Revolutionary leader
  governor_id UUID REFERENCES public.users(id), -- Defending governor

  -- Battle timing (1 hour duration)
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',

  -- Battle state
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revolutionary_win', 'government_win')),

  -- Scores and defense
  attacker_score INTEGER NOT NULL DEFAULT 0,
  defender_score INTEGER NOT NULL DEFAULT 0,
  initial_defense INTEGER NOT NULL DEFAULT 10000,
  current_defense INTEGER NOT NULL DEFAULT 10000,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_civil_wars_rebellion
  ON public.civil_wars(rebellion_id);
CREATE INDEX IF NOT EXISTS idx_civil_wars_status
  ON public.civil_wars(status);
CREATE INDEX IF NOT EXISTS idx_civil_wars_active
  ON public.civil_wars(ends_at)
  WHERE status = 'active';

-- Enable Realtime
ALTER TABLE public.civil_wars REPLICA IDENTITY FULL;

-- ============================================================================
-- 4. REBELLION_NEGOTIATIONS TABLE - Scalable for future contracts/voting
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rebellion_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebellion_id UUID NOT NULL REFERENCES public.rebellions(id) ON DELETE CASCADE,
  governor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rebel_leader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Negotiation flow
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_at TIMESTAMPTZ,
  accepted BOOLEAN,

  -- Scalable terms storage for future (laws, morale buffs, rank changes, etc.)
  terms_json JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_negotiations_rebellion
  ON public.rebellion_negotiations(rebellion_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_governor
  ON public.rebellion_negotiations(governor_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_active
  ON public.rebellion_negotiations(rebellion_id)
  WHERE response_at IS NULL;

-- Enable Realtime
ALTER TABLE public.rebellion_negotiations REPLICA IDENTITY FULL;

-- ============================================================================
-- 5. RPC: Calculate required supporters (20% of community, excluding governor)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_required_supports(
  p_community_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_total_members INTEGER;
BEGIN
  -- Count all members except the sovereign
  SELECT COUNT(*) INTO v_total_members
  FROM public.community_members
  WHERE community_id = p_community_id
    AND rank_tier != 0; -- Exclude governor

  -- Return 20%, minimum 1
  RETURN GREATEST(1, CEIL(v_total_members * 0.2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. RPC: Check if user can start a revolution
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_start_revolution(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_community_morale NUMERIC;
  v_user_morale NUMERIC;
  v_is_member BOOLEAN;
  v_is_sovereign BOOLEAN;
  v_active_rebellion_exists BOOLEAN;
  v_cooldown_active BOOLEAN;
BEGIN
  -- Check if user is a member
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_user_id AND community_id = p_community_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not a community member');
  END IF;

  -- Check if user is the sovereign (cannot start revolution against self)
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_user_id AND community_id = p_community_id AND rank_tier = 0
  ) INTO v_is_sovereign;

  IF v_is_sovereign THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Sovereign cannot start revolution');
  END IF;

  -- Check user's individual morale
  SELECT morale INTO v_user_morale
  FROM public.users
  WHERE id = p_user_id;

  -- Check community morale (simple average of all members)
  SELECT AVG(u.morale) INTO v_community_morale
  FROM public.users u
  JOIN public.community_members cm ON u.id = cm.user_id
  WHERE cm.community_id = p_community_id;

  -- Trigger condition: individual morale < 50 OR community morale < 30
  IF (v_user_morale < 50 OR v_community_morale < 30) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Morale too high. Individual must be < 50 or community < 30'
    );
  END IF;

  -- Check if active rebellion already exists
  SELECT EXISTS (
    SELECT 1 FROM public.rebellions
    WHERE community_id = p_community_id
      AND status IN ('agitation', 'battle')
  ) INTO v_active_rebellion_exists;

  IF v_active_rebellion_exists THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Active revolution already in progress');
  END IF;

  -- Check if cooldown is active
  SELECT EXISTS (
    SELECT 1 FROM public.rebellions
    WHERE community_id = p_community_id
      AND cooldown_until > NOW()
  ) INTO v_cooldown_active;

  IF v_cooldown_active THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Revolution cooldown still active');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. RPC: Start an uprising
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_uprising(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_can_start JSONB;
  v_required_supports INTEGER;
  v_new_rebellion_id UUID;
  v_sovereign_id UUID;
BEGIN
  -- Verify user can start
  SELECT public.can_start_revolution(p_user_id, p_community_id) INTO v_can_start;

  IF (v_can_start->>'allowed')::BOOLEAN IS NOT TRUE THEN
    RETURN v_can_start;
  END IF;

  -- Get the current sovereign (governor)
  SELECT user_id INTO v_sovereign_id
  FROM public.community_members
  WHERE community_id = p_community_id AND rank_tier = 0
  LIMIT 1;

  -- Calculate required supports (20% of non-sovereign members)
  SELECT public.calculate_required_supports(p_community_id) INTO v_required_supports;

  -- Create the rebellion
  INSERT INTO public.rebellions (
    community_id,
    leader_id,
    target_id,
    status,
    current_supports,
    required_supports,
    agitation_expires_at
  )
  VALUES (
    p_community_id,
    p_user_id,
    v_sovereign_id,
    'agitation',
    1, -- The leader counts as 1 support
    v_required_supports,
    NOW() + INTERVAL '1 hour'
  )
  RETURNING id INTO v_new_rebellion_id;

  -- Add the leader as the first supporter
  INSERT INTO public.rebellion_supports (rebellion_id, user_id)
  VALUES (v_new_rebellion_id, p_user_id);

  -- Log the event
  INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
  VALUES (
    p_user_id,
    'community',
    'UPRISING_STARTED',
    jsonb_build_object(
      'community_id', p_community_id,
      'rebellion_id', v_new_rebellion_id,
      'target_id', v_sovereign_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'rebellion_id', v_new_rebellion_id,
    'required_supports', v_required_supports,
    'message', 'Uprising started!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. RPC: Add support to an uprising
-- ============================================================================

CREATE OR REPLACE FUNCTION public.support_uprising(
  p_user_id UUID,
  p_rebellion_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rebellion RECORD;
  v_is_member BOOLEAN;
  v_is_sovereign BOOLEAN;
  v_already_supported BOOLEAN;
  v_new_support_count INTEGER;
  v_civil_war_id UUID;
BEGIN
  -- Get rebellion
  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = p_rebellion_id;

  IF v_rebellion IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Uprising not found');
  END IF;

  -- Check if user is a member
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_user_id AND community_id = v_rebellion.community_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not a community member');
  END IF;

  -- Check if user is the sovereign
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_user_id AND community_id = v_rebellion.community_id AND rank_tier = 0
  ) INTO v_is_sovereign;

  IF v_is_sovereign THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sovereign cannot support revolution');
  END IF;

  -- Check if already supported
  SELECT EXISTS (
    SELECT 1 FROM public.rebellion_supports
    WHERE rebellion_id = p_rebellion_id AND user_id = p_user_id
  ) INTO v_already_supported;

  IF v_already_supported THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already supporting this uprising');
  END IF;

  -- Add support
  INSERT INTO public.rebellion_supports (rebellion_id, user_id)
  VALUES (p_rebellion_id, p_user_id);

  -- Update support count
  SELECT COUNT(*) INTO v_new_support_count
  FROM public.rebellion_supports
  WHERE rebellion_id = p_rebellion_id;

  -- Check if threshold met to start civil war
  IF v_new_support_count >= v_rebellion.required_supports AND v_rebellion.status = 'agitation' THEN
    -- Start civil war
    INSERT INTO public.civil_wars (
      rebellion_id,
      attacker_community_id,
      defender_community_id,
      leader_id,
      governor_id,
      started_at,
      ends_at
    )
    VALUES (
      p_rebellion_id,
      v_rebellion.community_id,
      v_rebellion.community_id,
      v_rebellion.leader_id,
      v_rebellion.target_id,
      NOW(),
      NOW() + INTERVAL '1 hour'
    )
    RETURNING id INTO v_civil_war_id;

    -- Update rebellion status
    UPDATE public.rebellions
    SET status = 'battle', battle_started_at = NOW()
    WHERE id = p_rebellion_id;

    -- Log civil war start
    INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
    VALUES (
      p_user_id,
      'community',
      'CIVIL_WAR_STARTED',
      jsonb_build_object(
        'rebellion_id', p_rebellion_id,
        'civil_war_id', v_civil_war_id,
        'community_id', v_rebellion.community_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Threshold reached! Civil war started!',
      'battle_started', true,
      'civil_war_id', v_civil_war_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Support added',
    'current_supports', v_new_support_count,
    'required_supports', v_rebellion.required_supports
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. RPC: Exile the revolution leader (Governor action)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.exile_uprising_leader(
  p_rebellion_id UUID,
  p_governor_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rebellion RECORD;
  v_is_governor BOOLEAN;
BEGIN
  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = p_rebellion_id;

  IF v_rebellion IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Uprising not found');
  END IF;

  -- Verify caller is the governor
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_governor_id
      AND community_id = v_rebellion.community_id
      AND rank_tier = 0
  ) INTO v_is_governor;

  IF NOT v_is_governor THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the sovereign can exile the leader');
  END IF;

  -- Kick the leader from community (soft exile via community_members deletion)
  DELETE FROM public.community_members
  WHERE user_id = v_rebellion.leader_id AND community_id = v_rebellion.community_id;

  -- Mark as exiled in rebellion record
  UPDATE public.rebellions
  SET is_leader_exiled = TRUE,
      exiled_at = NOW(),
      cooldown_until = NOW() + INTERVAL '1 hour',
      cooldown_type = 'exile'
  WHERE id = p_rebellion_id;

  -- Apply morale penalty to the governor
  UPDATE public.users
  SET morale = GREATEST(0, morale - 15)
  WHERE id = p_governor_id;

  -- Log the exile
  INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
  VALUES (
    p_governor_id,
    'community',
    'UPRISING_LEADER_EXILED',
    jsonb_build_object(
      'rebellion_id', p_rebellion_id,
      'leader_id', v_rebellion.leader_id,
      'community_id', v_rebellion.community_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Revolution leader has been exiled. Uprising paused.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. RPC: Reinvite exiled leader (Advisor/Minister action)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reinvite_exiled_leader(
  p_rebellion_id UUID,
  p_inviter_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rebellion RECORD;
  v_inviter_rank INTEGER;
  v_community_id UUID;
BEGIN
  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = p_rebellion_id;

  IF v_rebellion IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Uprising not found');
  END IF;

  IF NOT v_rebellion.is_leader_exiled THEN
    RETURN jsonb_build_object('success', false, 'message', 'Leader is not exiled');
  END IF;

  -- Get inviter's rank (must be rank 0 or 1 to reinvite)
  SELECT rank_tier INTO v_inviter_rank
  FROM public.community_members
  WHERE user_id = p_inviter_id AND community_id = v_rebellion.community_id;

  IF v_inviter_rank IS NULL OR v_inviter_rank > 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only Sovereign or Advisor can reinvite');
  END IF;

  -- Reinvite the leader
  INSERT INTO public.community_members (community_id, user_id, rank_tier)
  VALUES (v_rebellion.community_id, v_rebellion.leader_id, 10)
  ON CONFLICT (community_id, user_id) DO UPDATE
  SET rank_tier = 10;

  -- Resume the rebellion (remove exile status, reset cooldown)
  UPDATE public.rebellions
  SET is_leader_exiled = FALSE,
      cooldown_until = NULL,
      cooldown_type = NULL
  WHERE id = p_rebellion_id;

  -- Log the reinvitation
  INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
  VALUES (
    p_inviter_id,
    'community',
    'UPRISING_LEADER_REINVITED',
    jsonb_build_object(
      'rebellion_id', p_rebellion_id,
      'leader_id', v_rebellion.leader_id,
      'inviter_id', p_inviter_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Exiled leader reinvited. Uprising resumes!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. RPC: Request negotiation (Governor action)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_negotiation(
  p_rebellion_id UUID,
  p_governor_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rebellion RECORD;
  v_is_governor BOOLEAN;
  v_negotiation_id UUID;
BEGIN
  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = p_rebellion_id;

  IF v_rebellion IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Uprising not found');
  END IF;

  -- Verify caller is the governor
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_governor_id
      AND community_id = v_rebellion.community_id
      AND rank_tier = 0
  ) INTO v_is_governor;

  IF NOT v_is_governor THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the sovereign can negotiate');
  END IF;

  -- Create negotiation request
  INSERT INTO public.rebellion_negotiations (
    rebellion_id,
    governor_id,
    rebel_leader_id,
    requested_at
  )
  VALUES (
    p_rebellion_id,
    p_governor_id,
    v_rebellion.leader_id,
    NOW()
  )
  RETURNING id INTO v_negotiation_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Negotiation request sent',
    'negotiation_id', v_negotiation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. RPC: Respond to negotiation (Leader action)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_negotiation(
  p_negotiation_id UUID,
  p_leader_id UUID,
  p_accepted BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_negotiation RECORD;
  v_rebellion RECORD;
BEGIN
  SELECT * INTO v_negotiation FROM public.rebellion_negotiations WHERE id = p_negotiation_id;

  IF v_negotiation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Negotiation not found');
  END IF;

  -- Verify caller is the rebel leader
  IF v_negotiation.rebel_leader_id != p_leader_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the rebel leader can respond');
  END IF;

  -- Get the rebellion
  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = v_negotiation.rebellion_id;

  -- Update negotiation response
  UPDATE public.rebellion_negotiations
  SET response_at = NOW(),
      accepted = p_accepted
  WHERE id = p_negotiation_id;

  IF p_accepted THEN
    -- End the rebellion with 'negotiated' status
    UPDATE public.rebellions
    SET status = 'negotiated',
        cooldown_until = NOW() + INTERVAL '72 hours',
        cooldown_type = 'negotiation'
    WHERE id = v_rebellion.id;

    -- Reset morale for all involved to 50
    UPDATE public.users
    SET morale = 50
    WHERE id IN (v_rebellion.leader_id, v_rebellion.target_id);

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Negotiation accepted. Peace agreed!',
      'accepted', true
    );
  ELSE
    -- Revolution continues
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Negotiation rejected. Revolution continues!',
      'accepted', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 13. RPC: Resolve civil war (after battle ends)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_civil_war(
  p_civil_war_id UUID,
  p_winner_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_civil_war RECORD;
  v_rebellion RECORD;
  v_outcome TEXT;
BEGIN
  SELECT * INTO v_civil_war FROM public.civil_wars WHERE id = p_civil_war_id;

  IF v_civil_war IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Civil war not found');
  END IF;

  SELECT * INTO v_rebellion FROM public.rebellions WHERE id = v_civil_war.rebellion_id;

  -- Determine outcome based on winner
  IF p_winner_id = v_civil_war.leader_id THEN
    v_outcome := 'revolutionary_win';
  ELSE
    v_outcome := 'government_win';
  END IF;

  -- Update civil war status
  UPDATE public.civil_wars
  SET status = v_outcome
  WHERE id = p_civil_war_id;

  IF v_outcome = 'revolutionary_win' THEN
    -- Swap sovereign: new leader gets rank 0, old sovereign gets rank 10
    UPDATE public.community_members
    SET rank_tier = 0
    WHERE community_id = v_civil_war.attacker_community_id
      AND user_id = v_civil_war.leader_id;

    UPDATE public.community_members
    SET rank_tier = 10
    WHERE community_id = v_civil_war.attacker_community_id
      AND user_id = v_civil_war.governor_id;

    -- Update rebellion status
    UPDATE public.rebellions
    SET status = 'success'
    WHERE id = v_rebellion.id;

    -- Apply morale bonuses to supporters, penalties to loyalists
    -- (Simple approach: get all supporters and apply +20 morale)
    UPDATE public.users
    SET morale = LEAST(100, morale + 20)
    WHERE id IN (
      SELECT user_id FROM public.rebellion_supports
      WHERE rebellion_id = v_rebellion.id
    );

    -- Apply penalty to loyalists (members who didn't support)
    UPDATE public.users
    SET morale = GREATEST(0, morale - 10)
    WHERE id IN (
      SELECT cm.user_id FROM public.community_members cm
      WHERE cm.community_id = v_rebellion.community_id
        AND cm.user_id NOT IN (
          SELECT user_id FROM public.rebellion_supports WHERE rebellion_id = v_rebellion.id
        )
        AND cm.rank_tier != 0 -- Don't penalize already-deposed governor
    );

    -- Log the victory
    INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
    VALUES (
      v_civil_war.leader_id,
      'community',
      'CIVIL_WAR_WON',
      jsonb_build_object(
        'rebellion_id', v_rebellion.id,
        'civil_war_id', p_civil_war_id,
        'community_id', v_civil_war.attacker_community_id
      )
    );

  ELSE
    -- Government victory
    UPDATE public.rebellions
    SET status = 'failed',
        cooldown_until = NOW() + INTERVAL '72 hours',
        cooldown_type = 'failure'
    WHERE id = v_rebellion.id;

    -- Log the defeat
    INSERT INTO public.game_logs (user_id, event_type, event_name, metadata)
    VALUES (
      v_civil_war.governor_id,
      'community',
      'CIVIL_WAR_WON',
      jsonb_build_object(
        'rebellion_id', v_rebellion.id,
        'civil_war_id', p_civil_war_id,
        'community_id', v_civil_war.attacker_community_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'message', CASE WHEN v_outcome = 'revolutionary_win' THEN 'Revolutionaries won!' ELSE 'Government defended!' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. RPC: Auto-fail uprising if agitation timer expires without threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_fail_expired_uprisings()
RETURNS TABLE(rebellion_id UUID, community_id UUID, status TEXT) AS $$
BEGIN
  UPDATE public.rebellions
  SET status = 'failed',
      cooldown_until = NOW() + INTERVAL '72 hours',
      cooldown_type = 'failure'
  WHERE status = 'agitation'
    AND agitation_expires_at < NOW()
  RETURNING rebellions.id, rebellions.community_id, rebellions.status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 15. Grant RLS Permissions
-- ============================================================================

-- RLS Policy: Users can view rebellions in their communities
CREATE POLICY "users_can_view_rebellions"
  ON public.rebellions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = rebellions.community_id
        AND user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert supports for active rebellions
CREATE POLICY "users_can_support_uprisings"
  ON public.rebellion_supports
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policy: Users can view negotiations for their community
CREATE POLICY "users_can_view_negotiations"
  ON public.rebellion_negotiations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id IN (
        SELECT community_id FROM public.rebellions WHERE id = rebellion_id
      )
        AND user_id = auth.uid()
    )
  );

-- Enable RLS
ALTER TABLE public.rebellions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebellion_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civil_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebellion_negotiations ENABLE ROW LEVEL SECURITY;
