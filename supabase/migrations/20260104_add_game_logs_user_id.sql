-- Ensure game_logs includes a reference to the acting user for audit consistency
ALTER TABLE game_logs
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_logs_user_id
ON game_logs(user_id, created_at DESC);
