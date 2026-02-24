-- ============================================================================
-- Fix Battle Logs RLS and Remove Observer Tracking Pollution
-- ============================================================================
-- Problem: battle_logs has no INSERT policy, causing 400 errors
-- Solution: Add proper RLS + move observer tracking to separate table

-- 1. Add INSERT policy for battle_logs (server-side only via RPC)
DROP POLICY IF EXISTS "Public read logs" ON public.battle_logs;
CREATE POLICY "Public read logs" ON public.battle_logs
  FOR SELECT USING (true);

-- Battle logs should ONLY be inserted via server RPCs (attack_battle, etc)
-- NOT directly from client
CREATE POLICY "Server insert only" ON public.battle_logs
  FOR INSERT
  WITH CHECK (false); -- Block all direct inserts

-- 2. Create separate table for observer tracking (non-critical data)
CREATE TABLE IF NOT EXISTS public.battle_observers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(battle_id, user_id)
);

-- RLS for observers
ALTER TABLE public.battle_observers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read observers" ON public.battle_observers
  FOR SELECT USING (true);

CREATE POLICY "Users can track own views" ON public.battle_observers
  FOR INSERT
  WITH CHECK (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can update own views" ON public.battle_observers
  FOR UPDATE
  USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_battle_observers_battle_id
  ON public.battle_observers(battle_id);

CREATE INDEX IF NOT EXISTS idx_battle_observers_user_id
  ON public.battle_observers(user_id);

-- 3. Create helper function for upsert observer presence
CREATE OR REPLACE FUNCTION update_battle_observer(p_battle_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.battle_observers (battle_id, user_id, last_seen_at)
  VALUES (p_battle_id, p_user_id, NOW())
  ON CONFLICT (battle_id, user_id)
  DO UPDATE SET last_seen_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.battle_observers IS 'Tracks active viewers of battles (separate from critical battle_logs)';
