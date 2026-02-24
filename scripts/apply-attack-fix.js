// Apply the attack_battle fix
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyFix() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    }
  );

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260326_fix_attack_battle_columns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying attack_battle fix migration...\n');

  try {
    // Use the SQL editor endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: sql })
      }
    );

    if (response.ok) {
      console.log('✅ Migration applied successfully!');
    } else {
      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', text);

      // Try alternative method - use SQL directly via management API
      console.log('\nTrying direct SQL execution...');

      // For Supabase, we need to use their management API or the SQL editor
      // Since we don't have that, let's just output instructions
      console.log('\n📋 Manual Migration Required');
      console.log('================================');
      console.log('Please copy the following SQL and run it in your Supabase SQL editor:\n');
      console.log(sql);
      console.log('\n================================');
      console.log('\nOr you can run it using the Supabase CLI:');
      console.log('  supabase db push');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📋 Manual Migration Required');
    console.log('================================');
    console.log('Please copy the following SQL and run it in your Supabase SQL editor:\n');
    console.log(sql);
  }
}

applyFix().catch(console.error);
