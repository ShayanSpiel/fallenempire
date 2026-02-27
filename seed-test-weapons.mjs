#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedTestWeapons() {
  console.log('🔫 Starting weapon seeding for all users...\n');

  try {
    // 1. Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log(`Found ${users.length} users\n`);

    // 2. Get weapon resource ID
    const { data: weaponResource, error: weaponError } = await supabase
      .from('resources')
      .select('id')
      .eq('key', 'weapon')
      .single();

    if (weaponError) {
      console.error('Error fetching weapon resource:', weaponError);
      return;
    }

    console.log(`Weapon resource ID: ${weaponResource.id}\n`);

    // 3. Get all quality IDs (levels 1-5)
    const { data: qualities, error: qualitiesError } = await supabase
      .from('resource_qualities')
      .select('id, quality_level, name')
      .order('quality_level');

    if (qualitiesError) {
      console.error('Error fetching qualities:', qualitiesError);
      return;
    }

    console.log('Quality tiers:');
    qualities.forEach(q => console.log(`  Q${q.quality_level}: ${q.name} (${q.id})`));
    console.log('');

    // 4. For each user, add weapons
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`Processing user: ${user.username || user.id}...`);

      // Give 20 weapons of each quality (100 total)
      for (const quality of qualities) {
        const quantity = 20;

        // Check if inventory item already exists
        const { data: existing } = await supabase
          .from('user_inventory')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('resource_id', weaponResource.id)
          .eq('quality_id', quality.id)
          .single();

        if (existing) {
          // Update existing quantity
          const newQuantity = existing.quantity + quantity;
          const { error: updateError } = await supabase
            .from('user_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`  ❌ Error updating Q${quality.quality_level} weapons:`, updateError.message);
            errorCount++;
          } else {
            console.log(`  ✅ Updated Q${quality.quality_level} weapons: ${existing.quantity} → ${newQuantity}`);
            successCount++;
          }
        } else {
          // Insert new inventory item
          const { error: insertError } = await supabase
            .from('user_inventory')
            .insert({
              user_id: user.id,
              resource_id: weaponResource.id,
              quality_id: quality.id,
              quantity: quantity,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`  ❌ Error inserting Q${quality.quality_level} weapons:`, insertError.message);
            errorCount++;
          } else {
            console.log(`  ✅ Added Q${quality.quality_level} weapons: ${quantity}`);
            successCount++;
          }
        }
      }

      console.log('');
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Seeding complete!`);
    console.log(`   Users processed: ${users.length}`);
    console.log(`   Successful operations: ${successCount}`);
    console.log(`   Failed operations: ${errorCount}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

seedTestWeapons();
