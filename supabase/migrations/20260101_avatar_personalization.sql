-- Add avatar personalization columns for DiceBear fallback avatars
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_style TEXT DEFAULT 'micah',
  ADD COLUMN IF NOT EXISTS avatar_hair TEXT DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS avatar_eyes TEXT DEFAULT 'smiling',
  ADD COLUMN IF NOT EXISTS avatar_mouth TEXT DEFAULT 'smile',
  ADD COLUMN IF NOT EXISTS avatar_nose TEXT DEFAULT 'curve';
