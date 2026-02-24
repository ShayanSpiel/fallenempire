-- ============================================================================
-- POPULATE CENTRAL BANK WITH SAMPLE TRANSACTION DATA
-- Run this in Supabase SQL Editor to test Central Bank UI
-- ============================================================================

-- IMPORTANT: Replace YOUR_USER_ID with your actual user ID from the users table
-- To find your user ID, run: SELECT id FROM users WHERE username = 'Shayan';

DO $$
DECLARE
  v_user_id UUID;
  v_other_user_id UUID;
  v_community_currency_id UUID;
BEGIN
  -- Get your user ID (CHANGE THIS USERNAME IF NEEDED)
  SELECT id INTO v_user_id
  FROM users
  WHERE username = 'Shayan'
  LIMIT 1;

  -- Get another user ID for transfer transactions
  SELECT id INTO v_other_user_id
  FROM users
  WHERE id != v_user_id
  LIMIT 1;

  -- Get a community currency ID
  SELECT id INTO v_community_currency_id
  FROM community_currencies
  LIMIT 1;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Change the username in the script.';
  END IF;

  RAISE NOTICE 'Populating transactions for user ID: %', v_user_id;

  -- ============================================================================
  -- TODAY'S TRANSACTIONS (Recent activity)
  -- ============================================================================

  -- Battle start (outgoing - cost)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 10,
    'battle_cost', 'Battle start fee for Winterfell',
    jsonb_build_object('target_hex_id', '0,0,0', 'region_name', 'Winterfell'),
    'personal', NOW() - INTERVAL '2 hours'
  );

  -- Medal reward (incoming - reward)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    NULL, v_user_id, 'gold', 3,
    'medal_reward', 'Battle Hero Medal reward',
    jsonb_build_object('medal_key', 'battle_hero', 'damage_dealt', 1500),
    'global', NOW() - INTERVAL '1 hour'
  );

  -- Wage payment (incoming - community currency)
  IF v_community_currency_id IS NOT NULL THEN
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, community_currency_id, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      NULL, v_user_id, 'community', v_community_currency_id, 25,
      'wage_payment', 'Daily wage from Blacksmith',
      jsonb_build_object('company_name', 'Blacksmith', 'work_hours', 8),
      'community', NOW() - INTERVAL '3 hours'
    );
  END IF;

  -- Market purchase (outgoing)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, v_other_user_id, 'gold', 15,
    'purchase', 'Market purchase',
    jsonb_build_object('resource', 'Iron Ore', 'quantity', 10, 'quality', 'Q3'),
    'personal', NOW() - INTERVAL '4 hours'
  );

  -- ============================================================================
  -- YESTERDAY'S TRANSACTIONS
  -- ============================================================================

  -- Battle victory reward
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    NULL, v_user_id, 'gold', 50,
    'battle_reward', 'Battle Victory reward',
    jsonb_build_object('battle_id', gen_random_uuid(), 'damage_dealt', 2500),
    'global', NOW() - INTERVAL '1 day' - INTERVAL '5 hours'
  );

  -- Company creation (outgoing - cost)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 100,
    'company_creation', 'Company creation: Elite Weapons Forge',
    jsonb_build_object('company_type', 'weaponsmith', 'company_name', 'Elite Weapons Forge'),
    'personal', NOW() - INTERVAL '1 day' - INTERVAL '8 hours'
  );

  -- Market sale (incoming)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_other_user_id, v_user_id, 'gold', 45,
    'sale', 'Market sale',
    jsonb_build_object('resource', 'Steel Sword', 'quantity', 1, 'quality', 'Q4'),
    'personal', NOW() - INTERVAL '1 day' - INTERVAL '12 hours'
  );

  -- Training cost (outgoing)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 5,
    'training_cost', 'Training session',
    jsonb_build_object('stat_trained', 'strength', 'energy_used', 10),
    'personal', NOW() - INTERVAL '1 day' - INTERVAL '18 hours'
  );

  -- ============================================================================
  -- LAST WEEK'S TRANSACTIONS
  -- ============================================================================

  -- Multiple battle costs
  FOR i IN 1..5 LOOP
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      v_user_id, NULL, 'gold', 10,
      'battle_cost', 'Battle start fee for Region ' || i,
      jsonb_build_object('target_hex_id', i || ',0,0'),
      'personal', NOW() - INTERVAL '3 days' - (i * INTERVAL '6 hours')
    );
  END LOOP;

  -- Multiple wage payments
  IF v_community_currency_id IS NOT NULL THEN
    FOR i IN 1..7 LOOP
      INSERT INTO currency_transactions (
        from_user_id, to_user_id, currency_type, community_currency_id, amount,
        transaction_type, description, metadata, scope, created_at
      ) VALUES (
        NULL, v_user_id, 'community', v_community_currency_id, 20 + (i * 2),
        'wage_payment', 'Daily wage from Workshop',
        jsonb_build_object('company_name', 'Workshop', 'work_hours', 8),
        'community', NOW() - (i * INTERVAL '1 day')
      );
    END LOOP;
  END IF;

  -- Currency exchange (outgoing gold, incoming community)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 50,
    'exchange', 'Currency exchange to community coins',
    jsonb_build_object('exchange_rate', 1.5, 'amount_received', 75),
    'community', NOW() - INTERVAL '5 days'
  );

  -- Tax payment
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 10,
    'tax', 'Trade tax (5%)',
    jsonb_build_object('original_amount', 200, 'tax_rate', 0.05),
    'community', NOW() - INTERVAL '6 days'
  );

  -- ============================================================================
  -- LAST MONTH'S TRANSACTIONS
  -- ============================================================================

  -- Large purchase
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, v_other_user_id, 'gold', 250,
    'purchase', 'Market purchase',
    jsonb_build_object('resource', 'Legendary Armor', 'quantity', 1, 'quality', 'Q5'),
    'personal', NOW() - INTERVAL '15 days'
  );

  -- Large sale
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_other_user_id, v_user_id, 'gold', 300,
    'sale', 'Market sale',
    jsonb_build_object('resource', 'Diamond Ore', 'quantity', 50, 'quality', 'Q5'),
    'personal', NOW() - INTERVAL '20 days'
  );

  -- Community treasury deposit (using 'transfer' type)
  INSERT INTO currency_transactions (
    from_user_id, to_user_id, currency_type, amount,
    transaction_type, description, metadata, scope, created_at
  ) VALUES (
    v_user_id, NULL, 'gold', 100,
    'transfer', 'Treasury deposit for community development',
    jsonb_build_object('purpose', 'Infrastructure', 'type', 'treasury_deposit'),
    'community', NOW() - INTERVAL '25 days'
  );

  -- ============================================================================
  -- GLOBAL TRANSACTIONS (for Global tab - system-wide events)
  -- ============================================================================

  -- Multiple admin grants (global scope)
  FOR i IN 1..15 LOOP
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      NULL, v_user_id, 'gold', 10 + (i * 5),
      'admin_grant', 'System reward for daily login',
      jsonb_build_object('reason', 'daily_bonus', 'day', i),
      'global', NOW() - (i * INTERVAL '2 days') - INTERVAL '3 hours'
    );
  END LOOP;

  -- Global rewards from system events
  FOR i IN 1..10 LOOP
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      NULL, v_user_id, 'gold', 25,
      'reward', 'Community event participation reward',
      jsonb_build_object('event', 'global_tournament', 'rank', i),
      'global', NOW() - (i * INTERVAL '3 days')
    );
  END LOOP;

  -- Battle victories (global scope)
  FOR i IN 1..8 LOOP
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      NULL, v_user_id, 'gold', 40 + (i * 5),
      'battle_reward', 'Battle Victory reward',
      jsonb_build_object('battle_id', gen_random_uuid(), 'enemies_defeated', i * 10),
      'global', NOW() - (i * INTERVAL '4 days') - INTERVAL '8 hours'
    );
  END LOOP;

  -- ============================================================================
  -- COMMUNITY TRANSACTIONS (for Community tab - community economics)
  -- ============================================================================

  IF v_community_currency_id IS NOT NULL THEN
    -- Multiple community wage payments
    FOR i IN 1..20 LOOP
      INSERT INTO currency_transactions (
        from_user_id, to_user_id, currency_type, community_currency_id, amount,
        transaction_type, description, metadata, scope, created_at
      ) VALUES (
        NULL, v_user_id, 'community', v_community_currency_id, 18 + (i * 3),
        'wage_payment', 'Daily wage from Community Workshop',
        jsonb_build_object('company_name', 'Community Workshop', 'work_hours', 8),
        'community', NOW() - (i * INTERVAL '1 day') - INTERVAL '4 hours'
      );
    END LOOP;

    -- Community exchanges
    FOR i IN 1..10 LOOP
      INSERT INTO currency_transactions (
        from_user_id, to_user_id, currency_type, amount,
        transaction_type, description, metadata, scope, created_at
      ) VALUES (
        v_user_id, NULL, 'gold', 30 + (i * 10),
        'exchange', 'Gold to Community currency exchange',
        jsonb_build_object('exchange_rate', 1.2, 'community_coins_received', (30 + (i * 10)) * 1.2),
        'community', NOW() - (i * INTERVAL '2 days') - INTERVAL '6 hours'
      );
    END LOOP;

    -- Community taxes
    FOR i IN 1..8 LOOP
      INSERT INTO currency_transactions (
        from_user_id, to_user_id, currency_type, amount,
        transaction_type, description, metadata, scope, created_at
      ) VALUES (
        v_user_id, NULL, 'gold', 8 + (i * 2),
        'tax', 'Community tax (10%)',
        jsonb_build_object('tax_rate', 0.1, 'original_amount', (8 + (i * 2)) * 10),
        'community', NOW() - (i * INTERVAL '3 days')
      );
    END LOOP;
  END IF;

  -- Inter-community trades (between communities)
  FOR i IN 1..5 LOOP
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount,
      transaction_type, description, metadata, scope, created_at
    ) VALUES (
      v_user_id, v_other_user_id, 'gold', 75 + (i * 25),
      'transfer', 'Inter-community trade payment',
      jsonb_build_object('trade_type', 'resources', 'other_community', 'Northlands'),
      'inter_community', NOW() - (i * INTERVAL '5 days')
    );
  END LOOP;

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TRANSACTION DATA POPULATED ===';
  RAISE NOTICE 'Total transactions created: ~120';
  RAISE NOTICE '';
  RAISE NOTICE 'PERSONAL TAB (~30 transactions):';
  RAISE NOTICE '  • Battle Start (costs)';
  RAISE NOTICE '  • Market Purchase/Sale';
  RAISE NOTICE '  • Company Founded';
  RAISE NOTICE '  • Training Sessions';
  RAISE NOTICE '';
  RAISE NOTICE 'COMMUNITY TAB (~45 transactions):';
  RAISE NOTICE '  • Wage Payments (20)';
  RAISE NOTICE '  • Currency Exchanges (10)';
  RAISE NOTICE '  • Community Taxes (8)';
  RAISE NOTICE '  • Inter-Community Trades (5)';
  RAISE NOTICE '';
  RAISE NOTICE 'GLOBAL TAB (~35 transactions):';
  RAISE NOTICE '  • Admin Grants (15)';
  RAISE NOTICE '  • System Rewards (10)';
  RAISE NOTICE '  • Battle Victories (8)';
  RAISE NOTICE '  • Medal Rewards';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Go to /centralbank';
  RAISE NOTICE '2. Check all 3 tabs - Personal, Community, Global';
  RAISE NOTICE '3. Test pagination controls';
  RAISE NOTICE '4. Verify transaction icons and formatting';
  RAISE NOTICE '';

END;
$$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Check transactions by type
SELECT
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM currency_transactions
WHERE from_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1)
   OR to_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1)
GROUP BY transaction_type
ORDER BY count DESC;

-- Check recent transactions
SELECT
  created_at,
  transaction_type,
  CASE
    WHEN from_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1) THEN '📤 OUT'
    WHEN to_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1) THEN '📥 IN'
  END as direction,
  amount,
  description,
  scope
FROM currency_transactions
WHERE from_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1)
   OR to_user_id = (SELECT id FROM users WHERE username = 'Shayan' LIMIT 1)
ORDER BY created_at DESC
LIMIT 20;
