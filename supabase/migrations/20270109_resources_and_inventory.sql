-- Resources & Inventory System
-- Feature 2 of Economy Module

-- ============================================================================
-- TABLES
-- ============================================================================

-- Resource quality tiers (Q1-Q5)
CREATE TABLE IF NOT EXISTS resource_qualities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  quality_level INT NOT NULL CHECK (quality_level >= 1 AND quality_level <= 5),
  stat_multiplier NUMERIC NOT NULL CHECK (stat_multiplier > 0),
  drop_rate NUMERIC NOT NULL CHECK (drop_rate >= 0 AND drop_rate <= 1),
  color_hex TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_quality_level UNIQUE(quality_level)
);

-- Base resources (grain, iron, food, weapon, oil, ticket)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('raw_material', 'product', 'consumable')),
  icon_name TEXT, -- For UI icon reference
  tradeable BOOLEAN DEFAULT true,
  stackable BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User inventory
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  quality_id UUID NOT NULL REFERENCES resource_qualities(id) ON DELETE RESTRICT,
  quantity NUMERIC DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, resource_id, quality_id)
);

-- Community inventory (treasury)
CREATE TABLE IF NOT EXISTS community_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  quality_id UUID NOT NULL REFERENCES resource_qualities(id) ON DELETE RESTRICT,
  quantity NUMERIC DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(community_id, resource_id, quality_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_tradeable ON resources(tradeable);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_resource_id ON user_inventory(resource_id);
CREATE INDEX IF NOT EXISTS idx_community_inventory_community_id ON community_inventory(community_id);
CREATE INDEX IF NOT EXISTS idx_community_inventory_resource_id ON community_inventory(resource_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE resource_qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_inventory ENABLE ROW LEVEL SECURITY;

-- Resource qualities: Everyone can read
DROP POLICY IF EXISTS "Anyone can view resource qualities" ON resource_qualities;
CREATE POLICY "Anyone can view resource qualities"
  ON resource_qualities FOR SELECT
  TO authenticated
  USING (true);

-- Resources: Everyone can read
DROP POLICY IF EXISTS "Anyone can view resources" ON resources;
CREATE POLICY "Anyone can view resources"
  ON resources FOR SELECT
  TO authenticated
  USING (true);

-- User inventory: Users can only see their own inventory
DROP POLICY IF EXISTS "Users can view their own inventory" ON user_inventory;
CREATE POLICY "Users can view their own inventory"
  ON user_inventory FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert into their own inventory" ON user_inventory;
CREATE POLICY "Users can insert into their own inventory"
  ON user_inventory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own inventory" ON user_inventory;
CREATE POLICY "Users can update their own inventory"
  ON user_inventory FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Community inventory: Members can view, leaders can modify
DROP POLICY IF EXISTS "Community members can view treasury" ON community_inventory;
CREATE POLICY "Community members can view treasury"
  ON community_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_inventory.community_id
      AND community_members.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "System can modify community inventory" ON community_inventory;
CREATE POLICY "System can modify community inventory"
  ON community_inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update community inventory" ON community_inventory;
CREATE POLICY "System can update community inventory"
  ON community_inventory FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert quality tiers (Q1-Q5)
INSERT INTO resource_qualities (key, name, quality_level, stat_multiplier, drop_rate, color_hex)
VALUES
  ('common', 'Common', 1, 1.0, 0.70, '#9CA3AF'),
  ('uncommon', 'Uncommon', 2, 1.5, 0.20, '#10B981'),
  ('rare', 'Rare', 3, 2.0, 0.08, '#3B82F6'),
  ('epic', 'Epic', 4, 3.0, 0.015, '#A855F7'),
  ('legendary', 'Legendary', 5, 5.0, 0.005, '#F59E0B')
ON CONFLICT (key) DO NOTHING;

-- Insert base resources
INSERT INTO resources (key, name, description, category, icon_name, tradeable, stackable)
VALUES
  -- Raw materials
  ('grain', 'Grain', 'Agricultural crop used to produce food', 'raw_material', 'wheat', true, true),
  ('iron', 'Iron Ore', 'Raw metal ore used to forge weapons', 'raw_material', 'mountain', true, true),
  ('oil', 'Oil', 'Fuel required for inter-community travel', 'consumable', 'droplet', true, true),

  -- Products
  ('food', 'Food', 'Sustenance that boosts morale', 'product', 'apple', true, true),
  ('weapon', 'Weapon', 'Combat equipment for battles', 'product', 'sword', true, true),

  -- Consumables
  ('ticket', 'Travel Ticket', 'Required for traveling between communities', 'consumable', 'ticket', true, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get user's complete inventory grouped by category
CREATE OR REPLACE FUNCTION get_user_inventory(p_user_id UUID)
RETURNS TABLE (
  category TEXT,
  items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.category,
    jsonb_agg(
      jsonb_build_object(
        'id', ui.id,
        'resource_id', r.id,
        'resource_key', r.key,
        'resource_name', r.name,
        'resource_icon', r.icon_name,
        'quality_id', q.id,
        'quality_key', q.key,
        'quality_name', q.name,
        'quality_level', q.quality_level,
        'quality_color', q.color_hex,
        'quantity', ui.quantity,
        'stat_multiplier', q.stat_multiplier
      ) ORDER BY q.quality_level DESC, r.name
    ) as items
  FROM user_inventory ui
  JOIN resources r ON ui.resource_id = r.id
  JOIN resource_qualities q ON ui.quality_id = q.id
  WHERE ui.user_id = p_user_id
    AND ui.quantity > 0
  GROUP BY r.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get community's complete inventory grouped by category
CREATE OR REPLACE FUNCTION get_community_inventory(p_community_id UUID)
RETURNS TABLE (
  category TEXT,
  items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.category,
    jsonb_agg(
      jsonb_build_object(
        'id', ci.id,
        'resource_id', r.id,
        'resource_key', r.key,
        'resource_name', r.name,
        'resource_icon', r.icon_name,
        'quality_id', q.id,
        'quality_key', q.key,
        'quality_name', q.name,
        'quality_level', q.quality_level,
        'quality_color', q.color_hex,
        'quantity', ci.quantity,
        'stat_multiplier', q.stat_multiplier
      ) ORDER BY q.quality_level DESC, r.name
    ) as items
  FROM community_inventory ci
  JOIN resources r ON ci.resource_id = r.id
  JOIN resource_qualities q ON ci.quality_id = q.id
  WHERE ci.community_id = p_community_id
    AND ci.quantity > 0
  GROUP BY r.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add item to user inventory
CREATE OR REPLACE FUNCTION add_to_user_inventory(
  p_user_id UUID,
  p_resource_key TEXT,
  p_quality_key TEXT,
  p_quantity NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_resource_id UUID;
  v_quality_id UUID;
BEGIN
  -- Get resource ID
  SELECT id INTO v_resource_id FROM resources WHERE key = p_resource_key;
  IF v_resource_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resource not found');
  END IF;

  -- Get quality ID
  SELECT id INTO v_quality_id FROM resource_qualities WHERE key = p_quality_key;
  IF v_quality_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quality not found');
  END IF;

  -- Insert or update inventory
  INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
  VALUES (p_user_id, v_resource_id, v_quality_id, p_quantity)
  ON CONFLICT (user_id, resource_id, quality_id)
  DO UPDATE SET
    quantity = user_inventory.quantity + p_quantity,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'resource_key', p_resource_key,
    'quality_key', p_quality_key,
    'quantity_added', p_quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove item from user inventory
CREATE OR REPLACE FUNCTION remove_from_user_inventory(
  p_user_id UUID,
  p_resource_key TEXT,
  p_quality_key TEXT,
  p_quantity NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_resource_id UUID;
  v_quality_id UUID;
  v_current_quantity NUMERIC;
BEGIN
  -- Get resource ID
  SELECT id INTO v_resource_id FROM resources WHERE key = p_resource_key;
  IF v_resource_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resource not found');
  END IF;

  -- Get quality ID
  SELECT id INTO v_quality_id FROM resource_qualities WHERE key = p_quality_key;
  IF v_quality_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quality not found');
  END IF;

  -- Check current quantity
  SELECT quantity INTO v_current_quantity
  FROM user_inventory
  WHERE user_id = p_user_id
    AND resource_id = v_resource_id
    AND quality_id = v_quality_id;

  IF v_current_quantity IS NULL OR v_current_quantity < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient quantity',
      'available', COALESCE(v_current_quantity, 0),
      'required', p_quantity
    );
  END IF;

  -- Update inventory
  UPDATE user_inventory
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND resource_id = v_resource_id
    AND quality_id = v_quality_id;

  RETURN jsonb_build_object(
    'success', true,
    'resource_key', p_resource_key,
    'quality_key', p_quality_key,
    'quantity_removed', p_quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Give each existing user 1 sample item of each resource at common quality
DO $$
DECLARE
  v_user RECORD;
  v_common_quality_id UUID;
  v_grain_id UUID;
  v_iron_id UUID;
  v_food_id UUID;
BEGIN
  -- Get common quality ID
  SELECT id INTO v_common_quality_id FROM resource_qualities WHERE key = 'common';

  -- Get resource IDs
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_iron_id FROM resources WHERE key = 'iron';
  SELECT id INTO v_food_id FROM resources WHERE key = 'food';

  -- Give each user sample items
  FOR v_user IN SELECT id FROM users LOOP
    -- Add 10 grain
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_user.id, v_grain_id, v_common_quality_id, 10)
    ON CONFLICT (user_id, resource_id, quality_id) DO NOTHING;

    -- Add 5 iron
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_user.id, v_iron_id, v_common_quality_id, 5)
    ON CONFLICT (user_id, resource_id, quality_id) DO NOTHING;

    -- Add 3 food
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_user.id, v_food_id, v_common_quality_id, 3)
    ON CONFLICT (user_id, resource_id, quality_id) DO NOTHING;
  END LOOP;
END $$;

-- Give each community a sample treasury
DO $$
DECLARE
  v_community RECORD;
  v_common_quality_id UUID;
  v_rare_quality_id UUID;
  v_grain_id UUID;
  v_weapon_id UUID;
BEGIN
  -- Get quality IDs
  SELECT id INTO v_common_quality_id FROM resource_qualities WHERE key = 'common';
  SELECT id INTO v_rare_quality_id FROM resource_qualities WHERE key = 'rare';

  -- Get resource IDs
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_weapon_id FROM resources WHERE key = 'weapon';

  -- Give each community sample items
  FOR v_community IN SELECT id FROM communities LOOP
    -- Add 100 grain (common)
    INSERT INTO community_inventory (community_id, resource_id, quality_id, quantity)
    VALUES (v_community.id, v_grain_id, v_common_quality_id, 100)
    ON CONFLICT (community_id, resource_id, quality_id) DO NOTHING;

    -- Add 10 weapons (rare)
    INSERT INTO community_inventory (community_id, resource_id, quality_id, quantity)
    VALUES (v_community.id, v_weapon_id, v_rare_quality_id, 10)
    ON CONFLICT (community_id, resource_id, quality_id) DO NOTHING;
  END LOOP;
END $$;

-- Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION get_user_inventory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_inventory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_user_inventory(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_from_user_inventory(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
