-- Check all indexes on world_regions table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'world_regions'
ORDER BY indexname;

-- Check table size
SELECT
  pg_size_pretty(pg_total_relation_size('world_regions')) as total_size,
  pg_size_pretty(pg_relation_size('world_regions')) as table_size,
  pg_size_pretty(pg_total_relation_size('world_regions') - pg_relation_size('world_regions')) as indexes_size;

-- Check row count
SELECT COUNT(*) as total_rows FROM world_regions;

-- Check communities table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'communities'
ORDER BY indexname;

SELECT COUNT(*) as total_communities FROM communities;
