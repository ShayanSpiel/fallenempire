// Check the battle_logs table schema
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
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

  console.log('Checking battle_logs table schema...');

  // Try to fetch a log to see what columns exist
  const { data: logs, error } = await supabase
    .from('battle_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching log:', error);
    return;
  }

  if (logs && logs.length > 0) {
    console.log('\nBattle_logs columns:', Object.keys(logs[0]));
    console.log('\nSample log:', JSON.stringify(logs[0], null, 2));
  } else {
    console.log('No battle logs found in database');
  }
}

checkSchema().catch(console.error);
