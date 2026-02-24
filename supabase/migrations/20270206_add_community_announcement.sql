-- Add announcement fields to communities table for MESSAGE_OF_THE_DAY law
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_content TEXT,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ;

-- Index for querying announcements
CREATE INDEX IF NOT EXISTS idx_communities_announcement_updated 
ON communities(announcement_updated_at DESC) 
WHERE announcement_content IS NOT NULL;
