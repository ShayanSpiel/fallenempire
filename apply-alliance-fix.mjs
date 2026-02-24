#!/usr/bin/env node
/**
 * Fix Pending Alliances Script
 *
 * This script activates alliances where both communities have passed their proposals
 * but the alliance is still stuck in 'pending_target_approval' status.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPendingAlliances() {
  console.log('🔍 Finding alliances stuck in pending_target_approval status...\n');

  // Find all pending alliances
  const { data: pendingAlliances, error: fetchError } = await supabase
    .from('community_alliances')
    .select(`
      id,
      initiator_proposal_id,
      target_proposal_id,
      initiator_community_id,
      target_community_id,
      status
    `)
    .eq('status', 'pending_target_approval');

  if (fetchError) {
    console.error('❌ Error fetching pending alliances:', fetchError);
    process.exit(1);
  }

  if (!pendingAlliances || pendingAlliances.length === 0) {
    console.log('✅ No pending alliances found. All alliances are properly resolved!');
    return;
  }

  console.log(`📋 Found ${pendingAlliances.length} pending alliance(s):\n`);

  let fixedCount = 0;

  for (const alliance of pendingAlliances) {
    console.log(`\n🔧 Checking alliance ${alliance.id}...`);

    if (!alliance.initiator_proposal_id || !alliance.target_proposal_id) {
      console.log('   ⚠️  Missing proposal IDs, skipping...');
      continue;
    }

    // Check both proposals
    const { data: proposals } = await supabase
      .from('community_proposals')
      .select('id, status, law_type')
      .in('id', [alliance.initiator_proposal_id, alliance.target_proposal_id]);

    if (!proposals || proposals.length !== 2) {
      console.log('   ⚠️  Could not find both proposals, skipping...');
      continue;
    }

    const initiatorProposal = proposals.find(p => p.id === alliance.initiator_proposal_id);
    const targetProposal = proposals.find(p => p.id === alliance.target_proposal_id);

    console.log(`   📄 Initiator proposal status: ${initiatorProposal?.status}`);
    console.log(`   📄 Target proposal status: ${targetProposal?.status}`);

    // Check if both are passed
    if (initiatorProposal?.status === 'passed' && targetProposal?.status === 'passed') {
      console.log('   ✅ Both proposals passed! Activating alliance...');

      const { error: updateError } = await supabase
        .from('community_alliances')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
        })
        .eq('id', alliance.id);

      if (updateError) {
        console.error('   ❌ Error activating alliance:', updateError);
      } else {
        console.log('   ✅ Alliance activated successfully!');
        fixedCount++;
      }
    } else {
      console.log('   ⏭️  Not both proposals passed yet, leaving as pending...');
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Fixed ${fixedCount} alliance(s)!`);
  console.log(`${'='.repeat(60)}\n`);
}

fixPendingAlliances().catch(console.error);
