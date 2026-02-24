-- Enable Realtime broadcasts for world_regions so the map syncs instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_regions;
