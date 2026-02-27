-- Update Season 1 name to "Wilderness"
UPDATE battle_pass_seasons
SET name = 'Wilderness'
WHERE season_number = 1;

-- Unlock first 3 tiers for user Shayan
-- First, get the user_id for Shayan and the current active season_id
DO $$
DECLARE
  v_user_id UUID;
  v_season_id UUID;
BEGIN
  -- Get Shayan's user_id
  SELECT id INTO v_user_id
  FROM users
  WHERE username = 'Shayan'
  LIMIT 1;

  -- Get active season_id
  SELECT id INTO v_season_id
  FROM battle_pass_seasons
  WHERE is_active = true
  LIMIT 1;

  -- Only proceed if we found both
  IF v_user_id IS NOT NULL AND v_season_id IS NOT NULL THEN
    -- Award 1500 XP to Shayan (500 XP per tier * 3 = 1500)
    -- This will unlock tiers 1, 2, and 3
    INSERT INTO user_battle_pass_progress (user_id, season_id, current_tier, total_xp)
    VALUES (v_user_id, v_season_id, 3, 1500)
    ON CONFLICT (user_id, season_id)
    DO UPDATE SET
      current_tier = GREATEST(user_battle_pass_progress.current_tier, 3),
      total_xp = GREATEST(user_battle_pass_progress.total_xp, 1500);

    RAISE NOTICE 'Unlocked first 3 tiers for user Shayan (user_id: %)', v_user_id;
  ELSE
    RAISE NOTICE 'Could not find user Shayan or active season';
  END IF;
END $$;
