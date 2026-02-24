-- Provide a reusable helper for checking column existence without relying on client schema traversal.
DROP FUNCTION IF EXISTS public.has_table_column(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.has_table_column(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.has_table_column(
  p_schema TEXT,
  p_table TEXT,
  p_column TEXT
)
RETURNS TABLE(found BOOLEAN)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = p_column
  );
END;
$$;
