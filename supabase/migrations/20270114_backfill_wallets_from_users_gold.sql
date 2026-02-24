-- Backfill gold wallets from legacy public.users columns if present.

DO $$
DECLARE
  v_has_gold BOOLEAN;
  v_has_gold_coins BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'gold'
  ) INTO v_has_gold;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'gold_coins'
  ) INTO v_has_gold_coins;

  -- Ensure every public user has a gold wallet.
  INSERT INTO user_wallets (user_id, currency_type, gold_coins)
  SELECT u.id, 'gold', 0
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_wallets uw
    WHERE uw.user_id = u.id
      AND uw.currency_type = 'gold'
  );

  -- Prefer legacy users.gold_coins when present.
  IF v_has_gold_coins THEN
    EXECUTE '
      UPDATE user_wallets uw
      SET gold_coins = GREATEST(uw.gold_coins, u.gold_coins)
      FROM public.users u
      WHERE uw.user_id = u.id
        AND uw.currency_type = ''gold''
        AND u.gold_coins IS NOT NULL
    ';
  END IF;

  -- Fall back to legacy users.gold if present.
  IF v_has_gold THEN
    EXECUTE '
      UPDATE user_wallets uw
      SET gold_coins = GREATEST(uw.gold_coins, u.gold)
      FROM public.users u
      WHERE uw.user_id = u.id
        AND uw.currency_type = ''gold''
        AND u.gold IS NOT NULL
    ';
  END IF;
END $$;
