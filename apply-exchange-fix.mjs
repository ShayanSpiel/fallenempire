#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    const sql = await readFile('./supabase/migrations/20270216_fix_exchange_column_names.sql', 'utf-8');

    console.log('🚀 Applying migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(async () => {
      // If exec_sql doesn't exist, try direct query
      return await supabase.from('_migrations').select('*').limit(0).then(async () => {
        // Execute SQL directly
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (!statement.trim()) continue;
          const { error: stmtError } = await supabase.rpc('exec', { sql: statement });
          if (stmtError) throw stmtError;
        }
        return { data: null, error: null };
      });
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Changes applied:');
    console.log('  • Fixed main_community → main_community_id in order book functions');
    console.log('  • Fixed gold_remaining/currency_remaining to use filled_gold_amount');
    console.log('  • Updated create_exchange_order function');
    console.log('  • Updated accept_exchange_order function');
    console.log('  • Updated get_order_book_aggregated function');
    console.log('  • Updated get_order_book_individual function');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

applyMigration();
