#!/usr/bin/env node
/**
 * Check Alliances Status
 */

import { createClient } from '@supabase/supabase-js';
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

async function checkAlliances() {
  console.log('🔍 Checking all alliances in database...\n');

  // Get all alliances
  const { data: alliances, error } = await supabase
    .from('community_alliances')
    .select(`
      *,
      initiator:communities!initiator_community_id(name),
      target:communities!target_community_id(name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!alliances || alliances.length === 0) {
    console.log('ℹ️  No alliances found in database\n');
    return;
  }

  console.log(`📋 Found ${alliances.length} alliance(s):\n`);

  for (const alliance of alliances) {
    console.log(`Alliance ID: ${alliance.id}`);
    console.log(`  Initiator: ${alliance.initiator?.name || 'Unknown'}`);
    console.log(`  Target: ${alliance.target?.name || 'Unknown'}`);
    console.log(`  Status: ${alliance.status}`);
    console.log(`  Created: ${alliance.created_at}`);
    console.log(`  Activated: ${alliance.activated_at || 'Not activated'}`);
    console.log(`  Initiator Proposal: ${alliance.initiator_proposal_id || 'None'}`);
    console.log(`  Target Proposal: ${alliance.target_proposal_id || 'None'}`);
    console.log('');
  }

  // Check CFC_ALLIANCE proposals
  console.log('\n🔍 Checking CFC_ALLIANCE proposals...\n');

  const { data: proposals, error: propError } = await supabase
    .from('community_proposals')
    .select(`
      id,
      status,
      law_type,
      metadata,
      created_at,
      resolved_at,
      community:communities(name)
    `)
    .eq('law_type', 'CFC_ALLIANCE')
    .order('created_at', { ascending: false });

  if (propError) {
    console.error('❌ Error:', propError);
    return;
  }

  if (!proposals || proposals.length === 0) {
    console.log('ℹ️  No CFC_ALLIANCE proposals found\n');
    return;
  }

  console.log(`📋 Found ${proposals.length} CFC_ALLIANCE proposal(s):\n`);

  for (const proposal of proposals) {
    console.log(`Proposal ID: ${proposal.id}`);
    console.log(`  Community: ${proposal.community?.name || 'Unknown'}`);
    console.log(`  Target Community ID: ${proposal.metadata?.target_community_id || 'Unknown'}`);
    console.log(`  Status: ${proposal.status}`);
    console.log(`  Created: ${proposal.created_at}`);
    console.log(`  Resolved: ${proposal.resolved_at || 'Not resolved'}`);
    console.log('');
  }
}

checkAlliances().catch(console.error);
