-- Battle Mechanics Integration: Wrap existing resolve_battle_outcome
-- Version: 1.0
-- Date: December 29, 2025
-- Description: Integrate battle mechanics (momentum, disarray, rage, exhaustion) into battle resolution

-- ============================================================================
-- REPLACE resolve_expired_battles TO USE NEW MECHANICS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS VOID AS $$
DECLARE
  battle_record RECORD;
  v_result JSONB;
BEGIN
  FOR battle_record IN
    SELECT id FROM public.battles
    WHERE status = 'active'
      AND ends_at <= NOW()
  LOOP
    -- First resolve the battle normally (territory transfer, ranking, etc.)
    PERFORM public.resolve_battle_outcome(battle_record.id);

    -- Then apply battle mechanics (momentum, disarray, rage, exhaustion)
    BEGIN
      v_result := public.resolve_battle_with_mechanics(battle_record.id);

      -- Log result if needed
      IF v_result ? 'error' THEN
        RAISE WARNING 'Battle mechanics failed for battle %: %', battle_record.id, v_result->>'error';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail the entire resolution if mechanics fail
      RAISE WARNING 'Exception applying battle mechanics to battle %: %', battle_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION public.resolve_expired_battles IS 'Resolve expired battles and apply battle mechanics (momentum, disarray, rage, exhaustion)';
