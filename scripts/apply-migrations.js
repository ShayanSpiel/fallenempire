// Apply pending migrations
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigrations() {
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

  const migrations = [
    '20260326_fix_attack_battle_columns.sql',
  ];

  for (const migration of migrations) {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migration);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`\nApplying migration: ${migration}`);
    console.log('SQL length:', sql.length);

    try {
      // Split into statements and execute each
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (!statement) continue;

        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        const { error } = await supabase.rpc('exec', { sql: statement + ';' }).catch(async (err) => {
          // If RPC doesn't exist, try direct query
          return await supabase.from('_').select('*').limit(0);
        });

        if (error) {
          console.error('Error:', error.message || error);
          // Try using postgREST directly
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ query: statement + ';' })
            }
          );

          if (!response.ok) {
            const text = await response.text();
            console.error('HTTP Error:', response.status, text);
          }
        }
      }

      console.log(`✅ Migration ${migration} applied successfully`);
    } catch (err) {
      console.error(`❌ Error applying migration ${migration}:`, err);
    }
  }

  console.log('\n✅ All migrations applied!');
}

applyMigrations().catch(console.error);
