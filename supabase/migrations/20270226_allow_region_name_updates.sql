-- Allow community leaders (Sovereign rank) to update custom_name for regions they own
-- This enables the region renaming feature in the map drawer

DROP POLICY IF EXISTS "Community leaders can update region names" ON public.world_regions;

CREATE POLICY "Community leaders can update region names"
ON public.world_regions
FOR UPDATE
USING (
  owner_community_id IN (
    SELECT cm.community_id
    FROM public.community_members cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.auth_id = auth.uid()
      AND cm.rank_tier >= 3  -- Sovereign rank or higher
  )
);
