-- Add community join and create actions to morale system

INSERT INTO action_definitions (action_key, display_name, morale_impact) VALUES
  ('COMMUNITY_JOIN', 'Join Community', 3),
  ('COMMUNITY_CREATE', 'Create Community', 8)
ON CONFLICT (action_key) DO NOTHING;
