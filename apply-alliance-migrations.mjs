#!/usr/bin/env node
/**
 * Apply Alliance Fix Migrations
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  console.log('📦 Applying alliance fix migrations...\n');

  const migrations = [
    {
      name: '20270208_fix_pending_alliances.sql',
      description: 'Fix alliances stuck in pending status',
    },
    {
      name: '20270209_fix_alliance_rls.sql',
      description: 'Fix alliance RLS policies to allow inserts',
    },
  ];

  for (const migration of migrations) {
    console.log(`\n🔧 Applying: ${migration.name}`);
    console.log(`   ${migration.description}\n`);

    try {
      const sqlPath = join(__dirname, 'supabase', 'migrations', migration.name);
      const sql = readFileSync(sqlPath, 'utf-8');

      const { error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        // Try direct execution as fallback
        console.log('   ⚠️  RPC failed, trying direct execution...');

        // Split by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          const { error: execError } = await supabase.rpc('exec', {
            query: statement,
          });

          if (execError) {
            console.error(`   ❌ Error executing statement:`, execError);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
          }
        }
      } else {
        console.log('   ✅ Applied successfully!');
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Migration process completed!');
  console.log(`${'='.repeat(60)}\n`);
  console.log('Note: If you see errors above, you may need to run these migrations manually');
  console.log('using your database client or Supabase dashboard SQL editor.\n');
}

applyMigrations().catch(console.error);
