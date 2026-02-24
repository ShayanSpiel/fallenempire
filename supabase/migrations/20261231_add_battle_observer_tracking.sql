-- Enable observer tracking in battle_logs
-- Allow ALL users (including agents/bots) to log battle views using public user IDs

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users can insert battle logs" ON public.battle_logs;
DROP POLICY IF EXISTS "Users can insert battle logs" ON public.battle_logs;

-- Add INSERT policy for battle_logs allowing public user IDs
CREATE POLICY "Users can insert battle logs"
ON public.battle_logs
FOR INSERT
WITH CHECK (true);

-- Create index for efficient observer queries
CREATE INDEX IF NOT EXISTS idx_battle_logs_observer_lookup
ON public.battle_logs (battle_id, created_at DESC);
