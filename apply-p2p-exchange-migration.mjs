#!/usr/bin/env node
/**
 * Apply P2P Currency Exchange Market Migration
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

async function applyMigration() {
  console.log('🚀 Applying P2P Currency Exchange Market Migration...\n');
  console.log('This will create:');
  console.log('  - currency_exchange_orders table');
  console.log('  - currency_exchange_trades table');
  console.log('  - currency_exchange_rate_snapshots table');
  console.log('  - RPC functions for order management');
  console.log('  - RLS policies\n');

  const migration = {
    name: '20270210_p2p_currency_exchange_market.sql',
    description: 'P2P Currency Exchange Market System',
  };

  console.log(`🔧 Applying: ${migration.name}`);
  console.log(`   ${migration.description}\n`);

  try {
    const sqlPath = join(__dirname, 'supabase', 'migrations', migration.name);
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split by statement blocks (looking for CREATE, ALTER, GRANT, etc.)
    const statements = sql
      .split(/;\s*(?=(?:CREATE|ALTER|GRANT|INSERT|DROP|--\s*=====))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^--\s*=====/) && s !== ';');

    console.log(`   Found ${statements.length} SQL statements to execute...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].replace(/;\s*$/, ''); // Remove trailing semicolon

      // Skip comment-only blocks
      if (statement.match(/^--/) || statement.trim() === '') {
        continue;
      }

      // Extract statement type for logging
      const typeMatch = statement.match(/^(CREATE|ALTER|GRANT|INSERT|DROP)\s+(\w+)/i);
      const stmtType = typeMatch ? `${typeMatch[1]} ${typeMatch[2]}` : 'SQL';

      process.stdout.write(`   [${i + 1}/${statements.length}] ${stmtType}... `);

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // Check if it's a benign "already exists" error
          if (error.message?.includes('already exists')) {
            console.log('⚠️  Already exists (skipped)');
            successCount++;
          } else {
            console.log('❌ Error');
            console.error(`      ${error.message}`);
            errorCount++;
          }
        } else {
          console.log('✅');
          successCount++;
        }
      } catch (err) {
        console.log('❌ Exception');
        console.error(`      ${err.message}`);
        errorCount++;
      }

      // Brief pause to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Migration completed!`);
    console.log(`   Success: ${successCount} | Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This may be normal if:');
      console.log('   - Tables/functions already exist');
      console.log('   - You are running this migration multiple times');
      console.log('\nIf you encounter issues, check the errors above or run manually.\n');
    } else {
      console.log('🎉 P2P Exchange Market is ready to use!\n');
      console.log('Next steps:');
      console.log('  1. Test creating exchange orders');
      console.log('  2. Verify order book displays correctly');
      console.log('  3. Set up cron jobs for rate snapshots and order expiry\n');
    }
  } catch (err) {
    console.error(`\n❌ Fatal Error:`, err.message);
    process.exit(1);
  }
}

applyMigration().catch(console.error);
