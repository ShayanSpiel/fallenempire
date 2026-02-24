-- Add region_name column to world_regions table
-- Allows founders to rename regions with custom names instead of just hex IDs

ALTER TABLE public.world_regions
ADD COLUMN region_name TEXT DEFAULT NULL;

-- Create index on owner_community_id for faster queries when fetching regions
CREATE INDEX IF NOT EXISTS idx_world_regions_owner_community_id
ON public.world_regions(owner_community_id);