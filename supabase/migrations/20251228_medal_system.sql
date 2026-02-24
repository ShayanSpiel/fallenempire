-- Create medals lookup table
CREATE TABLE IF NOT EXISTS medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'achievement', -- achievement, special, event
  icon_type TEXT DEFAULT 'star', -- placeholder icon type
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_medals table to track earned medals
CREATE TABLE IF NOT EXISTS user_medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medal_id UUID NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb, -- can store battle_id, opponent_damage, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, medal_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_medals_user_id ON user_medals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_earned_at ON user_medals(earned_at);

-- Insert Battle Hero Medal
INSERT INTO medals (key, name, description, category, icon_type)
VALUES (
  'battle_hero',
  'Battle Hero',
  'Dealt the highest damage in a battle',
  'achievement',
  'sword'
) ON CONFLICT (key) DO NOTHING;