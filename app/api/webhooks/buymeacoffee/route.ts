import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createSubscription,
  renewSubscription,
  updateSubscription,
} from '@/app/actions/subscription';
import type { BMCWebhookPayload } from '@/lib/subscriptions/types';

// Initialize Supabase Admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Buy Me a Coffee Webhook Handler
// ============================================================================
// This endpoint receives webhook events from Buy Me a Coffee when subscription
// events occur (new subscription, renewal, cancellation)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const payload: BMCWebhookPayload = await request.json();

    console.log('[BMC Webhook] Received event:', payload.type);

    // TODO: Implement signature verification when BMC credentials are available
    // const signature = request.headers.get('x-bmc-signature');
    // if (!verifySignature(payload, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    // Extract data from payload
    const { type, data } = payload;
    const {
      supporter_email,
      support_id,
      membership_level_name,
      amount,
      currency,
      is_recurring,
    } = data;

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('email', supporter_email)
      .single();

    if (userError || !user) {
      console.error('[BMC Webhook] User not found for email:', supporter_email);
      // Return 200 to acknowledge receipt, but log the issue
      return NextResponse.json({
        received: true,
        warning: 'User not found - create account first',
      });
    }

    // Determine tier from membership level name
    const tier = determineTierFromMembership(membership_level_name, amount);

    if (!tier) {
      console.error('[BMC Webhook] Could not determine tier from:', membership_level_name, amount);
      return NextResponse.json({
        received: true,
        warning: 'Invalid membership tier',
      });
    }

    // Handle different event types
    switch (type) {
      case 'membership.started':
        await handleMembershipStarted(user.id, tier, support_id, amount);
        break;

      case 'membership.renewed':
        await handleMembershipRenewed(user.id, tier, support_id, amount);
        break;

      case 'membership.cancelled':
        await handleMembershipCancelled(user.id, support_id);
        break;

      default:
        console.warn('[BMC Webhook] Unknown event type:', type);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[BMC Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', received: true },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function determineTierFromMembership(
  membershipName: string,
  amount: number
): 'sigma' | 'omega' | null {
  // Match by membership name
  const nameLower = membershipName.toLowerCase();
  if (nameLower.includes('sigma')) return 'sigma';
  if (nameLower.includes('omega')) return 'omega';

  // Fallback: match by amount
  if (amount >= 14.99) return 'omega';
  if (amount >= 9.99) return 'sigma';

  return null;
}

async function handleMembershipStarted(
  userId: string,
  tier: 'sigma' | 'omega',
  supportId: string,
  amount: number
) {
  console.log('[BMC Webhook] Starting new subscription for user:', userId);

  // Calculate expiration date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const result = await createSubscription({
    userId,
    tier,
    paymentProvider: 'buymeacoffee',
    providerSubscriptionId: supportId,
    amountPaid: amount,
    expiresAt: expiresAt.toISOString(),
  });

  if (!result.success) {
    console.error('[BMC Webhook] Failed to create subscription:', result.error);
    throw new Error(result.error);
  }

  console.log('[BMC Webhook] Subscription created successfully');
}

async function handleMembershipRenewed(
  userId: string,
  tier: 'sigma' | 'omega',
  supportId: string,
  amount: number
) {
  console.log('[BMC Webhook] Renewing subscription for user:', userId);

  // Find active subscription by provider_subscription_id
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_subscription_id', supportId)
    .eq('status', 'active')
    .single();

  if (error || !subscription) {
    console.error('[BMC Webhook] Subscription not found, creating new one');
    // If subscription doesn't exist, create it
    await handleMembershipStarted(userId, tier, supportId, amount);
    return;
  }

  const result = await renewSubscription(subscription.id, amount);

  if (!result.success) {
    console.error('[BMC Webhook] Failed to renew subscription:', result.error);
    throw new Error(result.error);
  }

  console.log('[BMC Webhook] Subscription renewed and medal awarded');
}

async function handleMembershipCancelled(userId: string, supportId: string) {
  console.log('[BMC Webhook] Cancelling subscription for user:', userId);

  // Find active subscription
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_subscription_id', supportId)
    .eq('status', 'active')
    .single();

  if (error || !subscription) {
    console.error('[BMC Webhook] Subscription not found');
    return;
  }

  const result = await updateSubscription({
    subscriptionId: subscription.id,
    status: 'cancelled',
    notes: 'Cancelled via Buy Me a Coffee',
  });

  if (!result.success) {
    console.error('[BMC Webhook] Failed to cancel subscription:', result.error);
    throw new Error(result.error);
  }

  console.log('[BMC Webhook] Subscription cancelled successfully');
}

// ============================================================================
// Signature Verification (TODO: Implement when BMC credentials available)
// ============================================================================

// function verifySignature(payload: BMCWebhookPayload, signature: string | null): boolean {
//   if (!signature) return false;
//
//   const secret = process.env.BMC_WEBHOOK_SECRET;
//   if (!secret) {
//     console.warn('[BMC Webhook] No webhook secret configured');
//     return true; // Allow in development
//   }
//
//   // TODO: Implement signature verification based on BMC documentation
//   // This will vary depending on how BMC signs their webhooks
//
//   return true;
// }
