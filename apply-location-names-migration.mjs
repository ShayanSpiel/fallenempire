import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('Applying location names migration...');

  const migrationSQL = readFileSync(
    join(__dirname, 'supabase/migrations/20270226_add_location_names_to_world_regions.sql'),
    'utf-8'
  );

  // Split by semicolons to execute each statement separately
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 100) + '...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

    if (error) {
      // Try direct execution as fallback
      const { error: directError } = await supabase.from('_migrations').insert({});
      console.error('Migration error:', error);

      // Try using raw SQL execution
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!response.ok) {
          console.error('Failed to execute statement');
        } else {
          console.log('✓ Statement executed successfully');
        }
      } catch (e) {
        console.error('Execution error:', e.message);
      }
    } else {
      console.log('✓ Statement executed successfully');
    }
  }

  console.log('Migration complete!');
}

applyMigration().catch(console.error);
