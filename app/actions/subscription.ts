'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  type Subscription,
  type SubscriptionHistory,
  type UserSubscriptionStatus,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
  type AwardMedalInput,
  type UserTier,
  type SubscriptionTier,
  type SubscriptionStatus,
  getAvailableThemes,
  TIER_CONFIGS,
} from '@/lib/subscriptions/types';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Get User Subscription Status
// ============================================================================

export async function getUserSubscriptionStatus(
  userId?: string
): Promise<UserSubscriptionStatus | null> {
  const supabase = await createSupabaseServerClient();

  // If no userId provided, get current user
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) return null;
    userId = userData.id;
  }

  // Get user data with tier
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('user_tier')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('Error fetching user:', userError);
    return null;
  }

  const userTier = (user.user_tier as UserTier) || 'alpha';

  // Get active subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) {
    console.error('Error fetching subscription:', subError);
  }

  // Get supporter medal info
  const medalKey = TIER_CONFIGS[userTier].medal?.key || null;
  let medalMonthCount = 0;

  if (medalKey && subscription) {
    // Get medal from user_medals
    const { data: medalData } = await supabase
      .from('user_medals')
      .select('metadata')
      .eq('user_id', userId)
      .eq(
        'medal_id',
        supabase.from('medals').select('id').eq('key', medalKey).single()
      )
      .single();

    if (medalData?.metadata?.month_count) {
      medalMonthCount = medalData.metadata.month_count;
    } else if (subscription?.months_subscribed) {
      medalMonthCount = subscription.months_subscribed;
    }
  }

  const hasActiveSubscription = subscription?.status === 'active';
  const canAccessKeeperPass = userTier === 'sigma' || userTier === 'omega';

  return {
    hasActiveSubscription,
    tier: userTier,
    subscriptionTier: subscription?.tier as SubscriptionTier | null,
    status: subscription?.status as SubscriptionStatus | null,
    expiresAt: subscription?.expires_at || null,
    monthsSubscribed: subscription?.months_subscribed || 0,
    canAccessKeeperPass,
    availableThemes: getAvailableThemes(userTier),
    supporterMedal: {
      hasMedal: hasActiveSubscription && medalKey !== null,
      medalKey,
      monthCount: medalMonthCount,
    },
  };
}

// ============================================================================
// Create Subscription (Admin/System)
// ============================================================================

export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<{ success: boolean; error?: string; subscriptionId?: string }> {
  const supabase = await createSupabaseServerClient();

  try {
    // Cancel any existing active subscriptions
    const { error: cancelError } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('user_id', input.userId)
      .eq('status', 'active');

    if (cancelError) {
      console.error('Error cancelling old subscriptions:', cancelError);
    }

    // Create new subscription
    const subscriptionData: Partial<Subscription> = {
      user_id: input.userId,
      tier: input.tier,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: input.expiresAt || null,
      last_payment_at: new Date().toISOString(),
      payment_provider: input.paymentProvider,
      provider_subscription_id: input.providerSubscriptionId || null,
      provider_customer_id: input.providerCustomerId || null,
      months_subscribed: 0,
    };

    const { data: newSub, error: insertError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating subscription:', insertError);
      return { success: false, error: insertError.message };
    }

    // Create history entry
    const historyData: Partial<SubscriptionHistory> = {
      subscription_id: newSub.id,
      user_id: input.userId,
      event_type: 'created',
      new_status: 'active',
      new_tier: input.tier,
      amount_paid: input.amountPaid || null,
      currency: 'USD',
    };

    await supabase.from('subscription_history').insert(historyData);

    // Award initial supporter medal
    await awardSupporterMedal({
      userId: input.userId,
      subscriptionId: newSub.id,
      tier: input.tier,
    });

    // Update user tier (trigger will handle this, but we can also do it explicitly)
    const newUserTier: UserTier = input.tier;
    await supabase
      .from('users')
      .update({ user_tier: newUserTier })
      .eq('id', input.userId);

    // Enable keeper pass if applicable
    if (input.tier === 'sigma' || input.tier === 'omega') {
      await supabase
        .from('user_battle_pass_progress')
        .update({ has_keeper_pass: true })
        .eq('user_id', input.userId);
    }

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/battlepass');
    revalidatePath('/settings');

    return { success: true, subscriptionId: newSub.id };
  } catch (error) {
    console.error('Error in createSubscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Update Subscription (Admin/System)
// ============================================================================

export async function updateSubscription(
  input: UpdateSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  try {
    // Get current subscription
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', input.subscriptionId)
      .single();

    if (fetchError || !currentSub) {
      return { success: false, error: 'Subscription not found' };
    }

    // Prepare update data
    const updateData: Partial<Subscription> = {};
    if (input.status) updateData.status = input.status;
    if (input.expiresAt) updateData.expires_at = input.expiresAt;
    if (input.tier) updateData.tier = input.tier;
    if (input.status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    // Update subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', input.subscriptionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Create history entry
    const eventType = input.status === 'cancelled' ? 'cancelled' : input.status === 'expired' ? 'expired' : input.tier && input.tier !== currentSub.tier ? 'upgraded' : 'renewed';

    const historyData: Partial<SubscriptionHistory> = {
      subscription_id: input.subscriptionId,
      user_id: currentSub.user_id,
      event_type: eventType,
      old_status: currentSub.status as SubscriptionStatus,
      new_status: input.status || (currentSub.status as SubscriptionStatus),
      old_tier: currentSub.tier as SubscriptionTier,
      new_tier: input.tier || (currentSub.tier as SubscriptionTier),
      notes: input.notes || null,
      changed_by: input.changedBy || null,
    };

    await supabase.from('subscription_history').insert(historyData);

    // If downgrading/cancelling, update user tier and disable keeper pass
    if (input.status === 'cancelled' || input.status === 'expired') {
      await supabase
        .from('users')
        .update({ user_tier: 'alpha' })
        .eq('id', currentSub.user_id);

      await supabase
        .from('user_battle_pass_progress')
        .update({ has_keeper_pass: false })
        .eq('user_id', currentSub.user_id);
    }

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/battlepass');
    revalidatePath('/admin');

    return { success: true };
  } catch (error) {
    console.error('Error in updateSubscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Award Supporter Medal
// ============================================================================

export async function awardSupporterMedal(
  input: AwardMedalInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  try {
    // Get medal ID based on tier
    const medalKey =
      input.tier === 'sigma' ? 'sigma-supporter' : 'omega-supporter';

    const { data: medal, error: medalError } = await supabase
      .from('medals')
      .select('id')
      .eq('key', medalKey)
      .single();

    if (medalError || !medal) {
      return { success: false, error: 'Medal not found' };
    }

    // Get current subscription to get month count
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('months_subscribed')
      .eq('id', input.subscriptionId)
      .single();

    const monthCount = (subscription?.months_subscribed || 0) + 1;

    // Check if user already has this medal
    const { data: existingMedal } = await supabase
      .from('user_medals')
      .select('*')
      .eq('user_id', input.userId)
      .eq('medal_id', medal.id)
      .single();

    if (existingMedal) {
      // Update metadata with new month count
      await supabase
        .from('user_medals')
        .update({
          metadata: { month_count: monthCount },
        })
        .eq('id', existingMedal.id);
    } else {
      // Award new medal
      await supabase.from('user_medals').insert({
        user_id: input.userId,
        medal_id: medal.id,
        metadata: { month_count: monthCount },
      });
    }

    // Update subscription month count
    await supabase
      .from('subscriptions')
      .update({
        months_subscribed: monthCount,
        last_medal_awarded_at: new Date().toISOString(),
      })
      .eq('id', input.subscriptionId);

    // Create history entry
    await supabase.from('subscription_history').insert({
      subscription_id: input.subscriptionId,
      user_id: input.userId,
      event_type: 'medal_awarded',
      notes: `Awarded ${medalKey} medal (Month ${monthCount})`,
    });

    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Error awarding medal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Check and Expire Old Subscriptions
// ============================================================================

export async function checkAndExpireSubscriptions(): Promise<{
  success: boolean;
  expiredCount: number;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  try {
    // Call the database function to expire old subscriptions
    const { data, error } = await supabase.rpc('expire_old_subscriptions');

    if (error) {
      return { success: false, expiredCount: 0, error: error.message };
    }

    const expiredCount = data || 0;

    if (expiredCount > 0) {
      revalidatePath('/');
      revalidatePath('/profile');
      revalidatePath('/battlepass');
    }

    return { success: true, expiredCount };
  } catch (error) {
    console.error('Error checking subscriptions:', error);
    return {
      success: false,
      expiredCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Get All Subscriptions (Admin)
// ============================================================================

export async function getAllSubscriptions(): Promise<{
  success: boolean;
  subscriptions?: Array<Subscription & { username?: string }>;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  try {
    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: userData } = await supabase
      .from('users')
      .select('username')
      .eq('auth_id', user.id)
      .single();

    if (!userData || !['admin', 'shayan'].includes(userData.username)) {
      return { success: false, error: 'Not authorized' };
    }

    // Get all subscriptions with user info
    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        `
        *,
        users!inner(username)
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const subscriptions = data.map((sub: any) => ({
      ...sub,
      username: sub.users?.username,
    }));

    return { success: true, subscriptions };
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Renew Subscription (Monthly Payment)
// ============================================================================

export async function renewSubscription(
  subscriptionId: string,
  amountPaid?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  try {
    // Get subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Update subscription
    const newExpiresAt = new Date();
    newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);

    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        last_payment_at: new Date().toISOString(),
        expires_at: newExpiresAt.toISOString(),
      })
      .eq('id', subscriptionId);

    // Create history entry
    await supabase.from('subscription_history').insert({
      subscription_id: subscriptionId,
      user_id: subscription.user_id,
      event_type: 'renewed',
      old_status: subscription.status as SubscriptionStatus,
      new_status: 'active',
      amount_paid: amountPaid || null,
      currency: 'USD',
    });

    // Award monthly medal
    await awardSupporterMedal({
      userId: subscription.user_id,
      subscriptionId: subscriptionId,
      tier: subscription.tier as SubscriptionTier,
    });

    revalidatePath('/');
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Error renewing subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
