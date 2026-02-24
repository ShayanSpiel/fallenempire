// Test the attack_battle RPC
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testAttack() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('Testing attack_battle RPC...\n');

  // Get an active battle
  const { data: battles, error: battleError } = await supabase
    .from('battles')
    .select('*')
    .eq('status', 'active')
    .limit(1);

  if (battleError) {
    console.error('Error fetching battle:', battleError);
    return;
  }

  if (!battles || battles.length === 0) {
    console.log('No active battles found');
    return;
  }

  const battle = battles[0];
  console.log('Found battle:', battle.id);
  console.log('Current defense:', battle.current_defense);

  // Get a user
  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .limit(1);

  if (!users || users.length === 0) {
    console.log('No users found');
    return;
  }

  const user = users[0];
  console.log('Using user:', user.username, '(', user.id, ')');

  // Try to attack
  console.log('\nAttempting attack...');
  const { data, error } = await supabase.rpc('attack_battle', {
    p_battle_id: battle.id,
    p_damage: 100,
    p_actor_id: user.id
  });

  console.log('\nResult:');
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', JSON.stringify(error, null, 2));

  if (error) {
    console.log('\nError details:');
    console.log('  Message:', error.message);
    console.log('  Code:', error.code);
    console.log('  Details:', error.details);
    console.log('  Hint:', error.hint);
  }
}

testAttack().catch(console.error);
