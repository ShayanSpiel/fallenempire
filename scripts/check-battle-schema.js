// Check the battles table schema
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

  console.log('Checking battles table schema...');

  // Try to fetch a battle to see what columns exist
  const { data: battles, error } = await supabase
    .from('battles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching battle:', error);
    return;
  }

  if (battles && battles.length > 0) {
    console.log('\nBattle columns:', Object.keys(battles[0]));
    console.log('\nSample battle:', JSON.stringify(battles[0], null, 2));
  } else {
    console.log('No battles found in database');

    // Try to check information_schema
    const { data: columns } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'battles'
          ORDER BY ordinal_position
        `
      });

    console.log('Columns from schema:', columns);
  }
}

checkSchema().catch(console.error);
