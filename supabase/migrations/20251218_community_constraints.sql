-- Fix:
-- 1. Ensure a user can only be a member of 1 community at a time
-- 2. Ensure a user can only be a founder of 1 community at a time
-- 3. Validate founder status before allowing founder-only actions

-- Add unique constraint on founder role per user
ALTER TABLE IF EXISTS public.community_members
ADD CONSTRAINT unique_founder_per_user UNIQUE (user_id, role) WHERE role = 'founder';

-- Add trigger to enforce single membership per user
CREATE OR REPLACE FUNCTION enforce_single_community_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a different community membership (not including founder transitions)
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = NEW.user_id
      AND community_id != NEW.community_id
      AND role != 'founder'  -- Founder can transition communities
  ) THEN
    RAISE EXCEPTION 'User can only be a member of one community at a time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_membership
BEFORE INSERT OR UPDATE ON public.community_members
FOR EACH ROW
WHEN (NEW.role = 'member')
EXECUTE FUNCTION enforce_single_community_membership();

-- Create function to validate founder access
CREATE OR REPLACE FUNCTION validate_community_founder(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.community_members
  WHERE user_id = p_user_id
    AND community_id = p_community_id;

  RETURN v_role = 'founder';
END;
$$ LANGUAGE plpgsql;

-- Update declare_war function to validate founder
CREATE OR REPLACE FUNCTION declare_war(
  p_initiator_community_id UUID,
  p_target_community_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_war_id UUID;
  v_existing_status TEXT;
BEGIN
  -- If user_id provided, validate they are founder of initiator community
  IF p_user_id IS NOT NULL THEN
    IF NOT validate_community_founder(p_user_id, p_initiator_community_id) THEN
      RETURN jsonb_build_object('error', 'Only community founders can declare war');
    END IF;
  END IF;

  SELECT status INTO v_existing_status
  FROM public.diplomacy_states
  WHERE (initiator_community_id = p_initiator_community_id AND target_community_id = p_target_community_id)
     OR (initiator_community_id = p_target_community_id AND target_community_id = p_initiator_community_id)
  LIMIT 1;

  IF v_existing_status IS NOT NULL THEN
    RETURN jsonb_build_object('status', v_existing_status);
  END IF;

  INSERT INTO public.diplomacy_states (
    initiator_community_id,
    target_community_id,
    status
  )
  VALUES (
    p_initiator_community_id,
    p_target_community_id,
    'war'
  )
  RETURNING id INTO v_war_id;

  RETURN jsonb_build_object('status', 'war', 'id', v_war_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
