-- Subscription System Migration
-- Adds subscription tables, medal types, and supporting infrastructure

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Subscription tier type (mirrors user_tier_type but for active subscriptions)
CREATE TYPE subscription_tier_type AS ENUM ('sigma', 'omega');

-- Subscription status
CREATE TYPE subscription_status_type AS ENUM ('active', 'cancelled', 'expired', 'pending');

-- Payment provider type
CREATE TYPE payment_provider_type AS ENUM ('buymeacoffee', 'stripe', 'manual', 'other');

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Subscription details
  tier subscription_tier_type NOT NULL,
  status subscription_status_type NOT NULL DEFAULT 'pending',

  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Supporter medal tracking
  months_subscribed INTEGER NOT NULL DEFAULT 0,
  last_medal_awarded_at TIMESTAMPTZ,

  -- Payment provider info
  payment_provider payment_provider_type NOT NULL DEFAULT 'manual',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  provider_metadata JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions(expires_at)
  WHERE status = 'active';
CREATE INDEX idx_subscriptions_provider ON public.subscriptions(payment_provider, provider_subscription_id);

-- Partial unique index to ensure only one active subscription per user
CREATE UNIQUE INDEX idx_unique_active_subscription_per_user
  ON public.subscriptions(user_id)
  WHERE status = 'active';

-- ============================================================================
-- SUBSCRIPTION HISTORY TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'created', 'renewed', 'cancelled', 'expired', 'upgraded', 'downgraded'
  old_status subscription_status_type,
  new_status subscription_status_type,
  old_tier subscription_tier_type,
  new_tier subscription_tier_type,

  -- Payment info
  amount_paid NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',

  -- Metadata
  notes TEXT,
  changed_by UUID REFERENCES public.users(id), -- NULL if system-triggered
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_subscription_id ON public.subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

-- ============================================================================
-- SUPPORTER MEDALS (using existing medal system)
-- ============================================================================

-- Insert Sigma Supporter medal definition
INSERT INTO public.medals (key, name, description, icon_type, category)
VALUES
  (
    'sigma-supporter',
    'Sigma Supporter',
    'Supporting the game as a Sigma tier subscriber. Thank you for your support!',
    'shield',
    'supporter'
  )
ON CONFLICT (key) DO NOTHING;

-- Insert Omega Supporter medal definition
INSERT INTO public.medals (key, name, description, icon_type, category)
VALUES
  (
    'omega-supporter',
    'Omega Supporter',
    'Supporting the game as an Omega tier subscriber. A true champion of the cause!',
    'crown',
    'supporter'
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

-- Admins can view all subscriptions (add admin check as needed)
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
      AND username IN ('admin', 'shayan') -- Update with your admin usernames
    )
  );

-- Users can view their own subscription history
CREATE POLICY "Users can view own subscription history"
  ON public.subscription_history
  FOR SELECT
  USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

-- Admins can view all subscription history
CREATE POLICY "Admins can view all subscription history"
  ON public.subscription_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
      AND username IN ('admin', 'shayan') -- Update with your admin usernames
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Function to sync user_tier with active subscription
CREATE OR REPLACE FUNCTION sync_user_tier_from_subscription()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_tier user_tier_type;
BEGIN
  -- Determine the user_id
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Get the highest tier from active subscriptions
  SELECT
    CASE
      WHEN MAX(CASE WHEN tier = 'omega' THEN 2 WHEN tier = 'sigma' THEN 1 ELSE 0 END) = 2 THEN 'omega'::user_tier_type
      WHEN MAX(CASE WHEN tier = 'omega' THEN 2 WHEN tier = 'sigma' THEN 1 ELSE 0 END) = 1 THEN 'sigma'::user_tier_type
      ELSE 'alpha'::user_tier_type
    END INTO new_tier
  FROM public.subscriptions
  WHERE user_id = target_user_id AND status = 'active';

  -- Default to alpha if no active subscription
  IF new_tier IS NULL THEN
    new_tier := 'alpha'::user_tier_type;
  END IF;

  -- Update user tier
  UPDATE public.users
  SET user_tier = new_tier
  WHERE id = target_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync user_tier when subscription changes
CREATE TRIGGER sync_user_tier_on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_tier_from_subscription();

-- Function to check and expire old subscriptions
CREATE OR REPLACE FUNCTION expire_old_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update expired subscriptions
  WITH expired AS (
    UPDATE public.subscriptions
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id, user_id, tier
  )
  -- Log to history
  INSERT INTO public.subscription_history (
    subscription_id, user_id, event_type,
    old_status, new_status, old_tier, new_tier
  )
  SELECT
    id, user_id, 'expired',
    'active'::subscription_status_type,
    'expired'::subscription_status_type,
    tier, tier
  FROM expired;

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.subscriptions IS 'User subscription data for Sigma and Omega tiers';
COMMENT ON TABLE public.subscription_history IS 'Audit trail of all subscription changes';
COMMENT ON COLUMN public.subscriptions.months_subscribed IS 'Counter for supporter medal (increments each month payment is received)';
COMMENT ON FUNCTION expire_old_subscriptions() IS 'Call this periodically to expire old subscriptions and downgrade users';
