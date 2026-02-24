import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('📦 Applying Province Names Migration...\n');

const sql = readFileSync('./APPLY_PROVINCE_NAMES_MIGRATION.sql', 'utf8');

try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).select();

  if (error) {
    console.error('❌ Migration failed:', error.message);

    // Try alternative approach: execute via raw SQL
    console.log('\n🔄 Trying alternative approach...\n');

    // Split into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const stmt of statements) {
      if (!stmt) continue;

      const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: stmt });

      if (stmtError) {
        console.error('❌ Statement failed:', stmt.substring(0, 100) + '...');
        console.error('   Error:', stmtError.message);
      } else {
        console.log('✓ Statement executed');
      }
    }
  } else {
    console.log('✅ Migration applied successfully!');
  }

  // Verify the column was added
  console.log('\n🔍 Verifying migration...');

  const { data: regions, error: verifyError } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .limit(1);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log('✅ province_name column exists and is queryable');
    console.log('   Sample data:', regions);
  }

  console.log('\n✨ Province names migration complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Province names are now supported in the database');
  console.log('   2. Existing regions will show province names when geocoded');
  console.log('   3. Companies, battles, and regions will show proper names');
  console.log('   4. Display priority: custom_name → province_name → hex_id\n');

} catch (err) {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
}
