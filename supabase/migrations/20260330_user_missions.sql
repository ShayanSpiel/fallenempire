-- User Missions System
-- Tracks daily/weekly mission progress for users

CREATE TABLE IF NOT EXISTS user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('daily', 'weekly')),
  progress INTEGER NOT NULL DEFAULT 0,
  goal INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete', 'claimed')),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,

  -- Ensure one mission per user per mission_id
  UNIQUE(user_id, mission_id)
);

-- Index for fast lookups
CREATE INDEX idx_user_missions_user_id ON user_missions(user_id);
CREATE INDEX idx_user_missions_status ON user_missions(status);
CREATE INDEX idx_user_missions_reset_at ON user_missions(reset_at);

-- Update timestamp trigger
CREATE TRIGGER update_user_missions_updated_at
  BEFORE UPDATE ON user_missions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

-- Users can read their own missions
CREATE POLICY "Users can view their own missions"
  ON user_missions
  FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- Users can update their own mission progress
CREATE POLICY "Users can update their own missions"
  ON user_missions
  FOR UPDATE
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- System can insert missions (service role)
CREATE POLICY "Service can insert missions"
  ON user_missions
  FOR INSERT
  WITH CHECK (true);

-- Function to initialize default missions for a user
CREATE OR REPLACE FUNCTION initialize_user_missions(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  end_of_day TIMESTAMPTZ;
  end_of_week TIMESTAMPTZ;
BEGIN
  end_of_day := (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second';
  end_of_week := (NOW() AT TIME ZONE 'UTC')::DATE + (7 - EXTRACT(DOW FROM NOW())) * INTERVAL '1 day' + INTERVAL '1 day' - INTERVAL '1 second';

  -- Daily Missions
  INSERT INTO user_missions (user_id, mission_id, mission_type, progress, goal, xp_reward, reset_at)
  VALUES
    (p_user_id, 'daily-train', 'daily', 0, 1, 30, end_of_day),
    (p_user_id, 'daily-battle', 'daily', 0, 1, 50, end_of_day)
  ON CONFLICT (user_id, mission_id) DO NOTHING;

  -- Weekly Missions
  INSERT INTO user_missions (user_id, mission_id, mission_type, progress, goal, xp_reward, reset_at)
  VALUES
    (p_user_id, 'weekly-post', 'weekly', 0, 1, 100, end_of_week),
    (p_user_id, 'join-community', 'weekly', 0, 1, 150, end_of_week),
    (p_user_id, 'make-friend', 'weekly', 0, 1, 75, end_of_week),
    (p_user_id, 'weekly-battles', 'weekly', 0, 3, 200, end_of_week),
    (p_user_id, 'grow-rank', 'weekly', 0, 1, 250, end_of_week),
    (p_user_id, 'weekly-engage', 'weekly', 0, 10, 150, end_of_week)
  ON CONFLICT (user_id, mission_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update mission progress
CREATE OR REPLACE FUNCTION update_mission_progress(
  p_user_id UUID,
  p_mission_id TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS TABLE(
  success BOOLEAN,
  new_progress INTEGER,
  goal INTEGER,
  is_complete BOOLEAN,
  mission_status TEXT
) AS $$
DECLARE
  v_mission RECORD;
  v_new_progress INTEGER;
  v_new_status TEXT;
BEGIN
  -- Ensure user has missions initialized
  PERFORM initialize_user_missions(p_user_id);

  -- Get current mission
  SELECT * INTO v_mission
  FROM user_missions
  WHERE user_id = p_user_id AND mission_id = p_mission_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, false, 'not_found'::TEXT;
    RETURN;
  END IF;

  -- Don't update if already claimed
  IF v_mission.status = 'claimed' THEN
    RETURN QUERY SELECT false, v_mission.progress, v_mission.goal, false, 'already_claimed'::TEXT;
    RETURN;
  END IF;

  -- Calculate new progress
  v_new_progress := LEAST(v_mission.progress + p_increment, v_mission.goal);
  v_new_status := CASE
    WHEN v_new_progress >= v_mission.goal THEN 'complete'
    ELSE 'incomplete'
  END;

  -- Update mission
  UPDATE user_missions
  SET
    progress = v_new_progress,
    status = v_new_status,
    updated_at = NOW()
  WHERE user_id = p_user_id AND mission_id = p_mission_id;

  RETURN QUERY SELECT
    true,
    v_new_progress,
    v_mission.goal,
    v_new_progress >= v_mission.goal,
    v_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim mission reward
CREATE OR REPLACE FUNCTION claim_mission_reward(
  p_user_id UUID,
  p_mission_id TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  xp_awarded INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_mission RECORD;
BEGIN
  -- Get mission
  SELECT * INTO v_mission
  FROM user_missions
  WHERE user_id = p_user_id AND mission_id = p_mission_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Mission not found'::TEXT;
    RETURN;
  END IF;

  IF v_mission.status != 'complete' THEN
    RETURN QUERY SELECT false, 0, 'Mission not complete'::TEXT;
    RETURN;
  END IF;

  IF v_mission.status = 'claimed' THEN
    RETURN QUERY SELECT false, 0, 'Already claimed'::TEXT;
    RETURN;
  END IF;

  -- Mark as claimed
  UPDATE user_missions
  SET
    status = 'claimed',
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id AND mission_id = p_mission_id;

  -- Award XP
  BEGIN
    PERFORM award_xp(p_user_id, v_mission.xp_reward, 'mission', jsonb_build_object('mission_id', p_mission_id));
  EXCEPTION WHEN OTHERS THEN
    -- XP function might not exist, continue anyway
    NULL;
  END;

  RETURN QUERY SELECT true, v_mission.xp_reward, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset expired missions
CREATE OR REPLACE FUNCTION reset_expired_missions()
RETURNS INTEGER AS $$
DECLARE
  rows_reset INTEGER;
BEGIN
  WITH reset_missions AS (
    UPDATE user_missions
    SET
      progress = 0,
      status = 'incomplete',
      reset_at = CASE
        WHEN mission_type = 'daily' THEN
          (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
        WHEN mission_type = 'weekly' THEN
          (NOW() AT TIME ZONE 'UTC')::DATE + (7 - EXTRACT(DOW FROM NOW())) * INTERVAL '1 day' + INTERVAL '1 day' - INTERVAL '1 second'
      END,
      updated_at = NOW(),
      claimed_at = NULL
    WHERE reset_at < NOW() AND status IN ('complete', 'claimed')
    RETURNING 1
  )
  SELECT COUNT(*) INTO rows_reset FROM reset_missions;

  RETURN rows_reset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
