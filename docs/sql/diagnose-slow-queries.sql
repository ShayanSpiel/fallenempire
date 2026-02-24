-- CRITICAL: Refresh table statistics so PostgreSQL knows about your index
ANALYZE world_regions;
ANALYZE communities;

-- Check if index is actually being used
EXPLAIN ANALYZE
SELECT hex_id, owner_community_id
FROM world_regions
ORDER BY hex_id;

-- Check if communities query is slow
EXPLAIN ANALYZE
SELECT id, name, color
FROM communities
WHERE id IN (1, 2, 3, 4, 5);

-- Check table bloat
SELECT
  schemaname,
  tablename,
  ROUND(100.0 * (CASE WHEN otta > 0 THEN sml.relpages - otta ELSE 0 END) /
    sml.relpages, 2) AS table_bloat_ratio,
  CASE WHEN relpages > otta THEN
    pg_size_pretty((relpages - otta)::bigint * 8192)
  ELSE '0 bytes'
  END AS bloat_size
FROM (
  SELECT schemaname, tablename, relpages,
    CEIL((cc * (1 + ma * av_width) +
      CEIL(cc * av_width * 25 / 100) + ma)::float / 8192) as otta
  FROM (
    SELECT
      n.nspname as schemaname,
      pg_class.relname as tablename,
      pg_class.relpages,
      cc,
      head_thpl + (cc * (datahdr + ma - (CASE WHEN datahdr % ma = 0
        THEN ma ELSE datahdr % ma END))) +
        (((cc - 1) / floor(8192 / (cc * ma + datahdr)))::int + 1) *
        (datahdr + ma) as otta,
      ma, datahdr, heloha, relpages, cc, extra_col
    FROM (
      SELECT
        n.nspname,
        pg_class.relname,
        pg_class.relpages,
        heloha,
        datahdr,
        ma,
        cc,
        CEIL((cc::float)/ (floor((8192 - pagehdr) / (datahdr + ma))))::int as rn,
        CEIL((pagehdr + gc) / 8.0) as head_thpl,
        0 as extra_col
      FROM (
        SELECT
          100 as pagehdr,
          0 as heloha,
          datahdr,
          (maxalignwith +
            (CASE WHEN datahdr % maxalignwith = 0 THEN maxalignwith
              ELSE datahdr % maxalignwith END))::int AS ma,
          cc
        FROM (
          SELECT
            (SELECT current_setting('block_size')::numeric) as bs,
            CEIL(cc::float) as cc,
            CEIL(cc::float / floor(((bs - pagehdr)::float / natts))) as ma,
            CEIL((CASE WHEN maxalign = 1
              THEN datahdr
              ELSE maxalign
              END)::float / (8.0)::float)::int AS maxalignwith,
            datahdr
          FROM (
            SELECT
              (SELECT (
                current_setting('block_size')::bigint - page_header_size) /
                (23 + 4)::float) AS cc,
              23 + 4 as datahdr,
              (
                SELECT max(fractionsum)
                FROM (
                  SELECT max(alg) as maxalign, bit_or(type_align) as fractionsum
                  FROM (
                    SELECT CASE WHEN type = 'N' THEN 1
                      WHEN type = 'C' THEN CASE WHEN max_len % 2 = 0 THEN 2
                        WHEN max_len % 4 = 0 THEN 4 ELSE 8 END
                      WHEN type = 'S' THEN 2
                      WHEN type = 'I' THEN 2
                      WHEN type = 'D' THEN 8
                      WHEN type = 'L' THEN 8
                      WHEN type = 'T' THEN 4
                      WHEN type = 'B' THEN 1
                      WHEN type = 'X' THEN 16
                      ELSE 8
                      END as type_align,
                      CASE WHEN type IN ('v', 'z', 'x') THEN 0
                        WHEN type = 'c' THEN attlen
                        ELSE 1
                        END as type_byval
                    FROM pg_type
                  ) t
                ) maxalign
              ) as max_len
          ) cml
        ) calc
      ) s
    ) a JOIN pg_class ON s.relname = pg_class.relname
      JOIN pg_namespace n ON n.oid = pg_class.relnamespace
      WHERE pg_class.relname IN ('world_regions', 'communities')
  ) sml
) bloat
WHERE schemaname = 'public'
ORDER BY bloat_size DESC;

-- Check for missing VACUUM/ANALYZE
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (relname = 'world_regions' OR relname = 'communities')
ORDER BY relname;

-- SOLUTION: Force analyze if stale
-- Run this if last_analyze is very old or NULL:
-- VACUUM ANALYZE world_regions;
-- VACUUM ANALYZE communities;
