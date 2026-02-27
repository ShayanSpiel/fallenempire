import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyUpdates() {
  try {
    // 1. Update season name to "Wilderness"
    console.log('Updating season name to "Wilderness"...');
    const { error: seasonError } = await supabase
      .from('battle_pass_seasons')
      .update({ name: 'Wilderness' })
      .eq('season_number', 1);

    if (seasonError) {
      console.error('Error updating season name:', seasonError);
      process.exit(1);
    }
    console.log('✓ Season name updated to "Wilderness"');

    // 2. Get Shayan's user_id
    console.log('Finding user Shayan...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'Shayan')
      .single();

    if (userError || !userData) {
      console.error('Error finding user Shayan:', userError);
      process.exit(1);
    }
    const userId = userData.id;
    console.log(`✓ Found user Shayan (${userId})`);

    // 3. Get active season
    console.log('Finding active season...');
    const { data: seasonData, error: findSeasonError } = await supabase
      .from('battle_pass_seasons')
      .select('id')
      .eq('is_active', true)
      .single();

    if (findSeasonError || !seasonData) {
      console.error('Error finding active season:', findSeasonError);
      process.exit(1);
    }
    const seasonId = seasonData.id;
    console.log(`✓ Found active season (${seasonId})`);

    // 4. Award 1500 XP to unlock first 3 tiers (500 XP per tier)
    console.log('Unlocking first 3 tiers for Shayan...');
    const { data: progressData, error: progressError } = await supabase
      .from('user_battle_pass_progress')
      .upsert({
        user_id: userId,
        season_id: seasonId,
        current_tier: 3,
        total_xp: 1500,
      }, {
        onConflict: 'user_id,season_id'
      })
      .select()
      .single();

    if (progressError) {
      console.error('Error updating progress:', progressError);
      process.exit(1);
    }

    console.log('✓ First 3 tiers unlocked for user Shayan');
    console.log(`  - Current tier: ${progressData.current_tier}`);
    console.log(`  - Total XP: ${progressData.total_xp}`);
    console.log('\nAll updates applied successfully!');
  } catch (err) {
    console.error('Failed to apply updates:', err);
    process.exit(1);
  }
}

applyUpdates();
