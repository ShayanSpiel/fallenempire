-- Update Adrenaline Configuration
-- Fixes damage threshold from 1.5x to 2.0x and check interval from 1s to 10s
-- Date: January 4, 2027

UPDATE battle_mechanics_config
SET
  adrenaline_damage_threshold_ratio = 2.0,
  adrenaline_check_interval_seconds = 10
WHERE adrenaline_damage_threshold_ratio = 1.5
   OR adrenaline_check_interval_seconds = 1;

-- Verify the update
SELECT
  community_id,
  adrenaline_enabled,
  adrenaline_final_stand_window_percent,
  adrenaline_damage_threshold_ratio,
  adrenaline_rage_per_percent_time,
  adrenaline_max_rage,
  adrenaline_check_interval_seconds
FROM battle_mechanics_config
ORDER BY community_id NULLS FIRST;
