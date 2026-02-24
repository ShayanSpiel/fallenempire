-- Add all missing avatar customization columns for complete Micah personalization
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_background_color TEXT DEFAULT 'b6e3f4',
  ADD COLUMN IF NOT EXISTS avatar_base_color TEXT DEFAULT 'f9c9b6',
  ADD COLUMN IF NOT EXISTS avatar_hair_color TEXT DEFAULT '000000',
  ADD COLUMN IF NOT EXISTS avatar_eyebrows TEXT DEFAULT 'up',
  ADD COLUMN IF NOT EXISTS avatar_eye_shadow_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_facial_hair TEXT,
  ADD COLUMN IF NOT EXISTS avatar_ears TEXT DEFAULT 'attached',
  ADD COLUMN IF NOT EXISTS avatar_earrings TEXT,
  ADD COLUMN IF NOT EXISTS avatar_earring_color TEXT DEFAULT 'd2eff3',
  ADD COLUMN IF NOT EXISTS avatar_glasses TEXT,
  ADD COLUMN IF NOT EXISTS avatar_glasses_color TEXT DEFAULT '000000',
  ADD COLUMN IF NOT EXISTS avatar_shirt TEXT DEFAULT 'crew',
  ADD COLUMN IF NOT EXISTS avatar_shirt_color TEXT DEFAULT '6bd9e9';
