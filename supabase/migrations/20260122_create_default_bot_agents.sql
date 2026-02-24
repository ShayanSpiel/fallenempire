-- Create default bot agents for the AI system
-- These are autonomous agents controlled by the AI orchestrator

INSERT INTO public.users (
  id,
  username,
  email,
  is_bot,
  power_mental,
  power_physical,
  freewill,
  morale,
  identity_json,
  identity_label,
  total_xp,
  current_level
)
VALUES
  (
    '13437ba3-ce93-4b0a-9b14-196d0dbb90ab'::uuid,
    'Agent_Meridian',
    'bot-meridian@system.internal',
    true,
    75,
    60,
    40,
    55,
    '{"order_chaos": 0.2, "power_harmony": 0.1, "tradition_innovation": 0.3, "self_community": 0.6, "logic_emotion": 0.4}'::jsonb,
    'Harmonizer',
    1000,
    5
  ),
  (
    '9dfae7f0-efa3-4096-b475-2ac55f83f4c6'::uuid,
    'Agent_Vortex',
    'bot-vortex@system.internal',
    true,
    85,
    70,
    35,
    65,
    '{"order_chaos": -0.4, "power_harmony": -0.2, "tradition_innovation": 0.5, "self_community": -0.3, "logic_emotion": -0.2}'::jsonb,
    'Chaos_Bringer',
    1200,
    6
  ),
  (
    '371abc87-cd98-454d-99e2-a84752ed52eb'::uuid,
    'Agent_Sentinel',
    'bot-sentinel@system.internal',
    true,
    70,
    80,
    50,
    70,
    '{"order_chaos": 0.6, "power_harmony": -0.1, "tradition_innovation": -0.2, "self_community": 0.5, "logic_emotion": 0.6}'::jsonb,
    'Enforcer',
    1100,
    5
  ),
  (
    'e5d0b675-6512-4e9d-b13d-3d84be51661b'::uuid,
    'Agent_Echo',
    'bot-echo@system.internal',
    true,
    65,
    55,
    60,
    50,
    '{"order_chaos": 0.0, "power_harmony": 0.3, "tradition_innovation": 0.2, "self_community": 0.7, "logic_emotion": -0.1}'::jsonb,
    'Diplomat',
    900,
    4
  ),
  (
    '06a26d28-143b-4d1b-b445-92d709ae81ed'::uuid,
    'Agent_Phoenix',
    'bot-phoenix@system.internal',
    true,
    90,
    75,
    45,
    60,
    '{"order_chaos": 0.1, "power_harmony": -0.3, "tradition_innovation": 0.6, "self_community": 0.2, "logic_emotion": 0.3}'::jsonb,
    'Innovator',
    1300,
    7
  ),
  (
    'ddf3fc04-1e2b-4223-8495-86dd953572ef'::uuid,
    'Agent_Cipher',
    'bot-cipher@system.internal',
    true,
    60,
    65,
    55,
    45,
    '{"order_chaos": -0.3, "power_harmony": 0.2, "tradition_innovation": 0.1, "self_community": -0.2, "logic_emotion": 0.8}'::jsonb,
    'Thinker',
    800,
    3
  ),
  (
    '4dd2de3f-0de0-405a-90de-13b1a86b2317'::uuid,
    'Agent_Nexus',
    'bot-nexus@system.internal',
    true,
    78,
    68,
    48,
    58,
    '{"order_chaos": 0.0, "power_harmony": 0.0, "tradition_innovation": 0.4, "self_community": 0.3, "logic_emotion": 0.5}'::jsonb,
    'Nexus_Controller',
    1050,
    5
  )
ON CONFLICT (id) DO UPDATE SET
  power_mental = EXCLUDED.power_mental,
  power_physical = EXCLUDED.power_physical,
  morale = EXCLUDED.morale;

-- Ensure RLS policies allow these bot users to exist
-- No additional RLS needed - the default policies should handle bot users
