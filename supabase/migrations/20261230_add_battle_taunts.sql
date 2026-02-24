-- Create battle_taunts table for taunt animations
CREATE TABLE IF NOT EXISTS public.battle_taunts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for battle taunts
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_taunts;

-- RLS: Public read for realtime, authenticated write
ALTER TABLE public.battle_taunts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle taunts"
  ON public.battle_taunts
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create taunts"
  ON public.battle_taunts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_battle_taunts_battle_id ON public.battle_taunts(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_taunts_created_at ON public.battle_taunts(created_at DESC);
