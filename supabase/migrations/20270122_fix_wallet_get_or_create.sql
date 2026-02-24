-- Fix wallet creation to avoid unique constraint violations during concurrent calls

CREATE OR REPLACE FUNCTION get_or_create_gold_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id AND currency_type = 'gold';

  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id, currency_type, gold_coins)
    VALUES (p_user_id, 'gold', 0)
    ON CONFLICT ON CONSTRAINT unique_gold_wallet DO NOTHING
    RETURNING id INTO v_wallet_id;

    IF v_wallet_id IS NULL THEN
      SELECT id INTO v_wallet_id
      FROM user_wallets
      WHERE user_id = p_user_id AND currency_type = 'gold';
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_or_create_community_wallet(
  p_user_id UUID,
  p_community_currency_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
    AND currency_type = 'community'
    AND community_currency_id = p_community_currency_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (
      user_id,
      currency_type,
      community_currency_id,
      community_coins
    )
    VALUES (p_user_id, 'community', p_community_currency_id, 0)
    ON CONFLICT ON CONSTRAINT unique_community_wallet DO NOTHING
    RETURNING id INTO v_wallet_id;

    IF v_wallet_id IS NULL THEN
      SELECT id INTO v_wallet_id
      FROM user_wallets
      WHERE user_id = p_user_id
        AND currency_type = 'community'
        AND community_currency_id = p_community_currency_id;
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
