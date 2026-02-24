-- Add military ranking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS battles_fought INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS battles_won INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_damage_dealt BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS highest_damage_battle INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_military_rank TEXT DEFAULT 'Recruit';
ALTER TABLE users ADD COLUMN IF NOT EXISTS military_rank_score BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_battle_win BOOLEAN DEFAULT NULL;

-- Create battle_participants table to track individual performance per battle
CREATE TABLE IF NOT EXISTS battle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  damage_dealt INTEGER NOT NULL DEFAULT 0,
  won BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one record per user per battle
  UNIQUE(user_id, battle_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_battle_participants_user_id ON battle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_battle_id ON battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_side ON battle_participants(side);
CREATE INDEX IF NOT EXISTS idx_users_military_rank_score ON users(military_rank_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_military_rank ON users(current_military_rank);

-- RLS policies for battle_participants
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all battle participants"
  ON battle_participants FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert battle participants"
  ON battle_participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update battle participants"
  ON battle_participants FOR UPDATE
  USING (true)
  WITH CHECK (true);
