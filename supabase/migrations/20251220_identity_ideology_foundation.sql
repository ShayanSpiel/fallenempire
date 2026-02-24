-- Identity & Ideology System Foundation
-- Creates columns for individual identity and community ideology
-- Supports scalable analysis with extensible input configuration

-- ============================================================================
-- 1. USERS TABLE: Add identity columns
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  identity_json JSONB DEFAULT '{"order_chaos":0,"self_community":0,"logic_emotion":0,"power_harmony":0,"tradition_innovation":0}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  identity_label TEXT DEFAULT 'Citizen';

-- Note: freewill may already exist from earlier migrations, adding if not
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  freewill NUMERIC DEFAULT 50 CHECK (freewill >= 0 AND freewill <= 100);

-- ============================================================================
-- 2. COMMUNITIES TABLE: Add ideology columns
-- ============================================================================

ALTER TABLE communities ADD COLUMN IF NOT EXISTS
  ideology_json JSONB DEFAULT '{"order_chaos":0,"self_community":0,"logic_emotion":0,"power_harmony":0,"tradition_innovation":0}'::jsonb;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS
  ideology_interpretation JSONB DEFAULT '{}'::jsonb;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS
  ideology_polarization_metrics JSONB DEFAULT '{}'::jsonb;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS
  last_ideology_update TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 3. COMMUNITY IDEOLOGY INPUTS TABLE (New)
-- Controls which data sources and weights feed into ideology calculation
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_ideology_inputs (
  community_id UUID PRIMARY KEY REFERENCES communities(id) ON DELETE CASCADE,

  -- Current inputs (enabled by default)
  include_member_vectors BOOLEAN DEFAULT true,
  include_leader_weight BOOLEAN DEFAULT true,
  include_action_history BOOLEAN DEFAULT true,

  -- Future inputs (disabled by default, can be enabled later)
  include_community_bio BOOLEAN DEFAULT false,
  include_chat_history BOOLEAN DEFAULT false,
  include_law_proposals BOOLEAN DEFAULT false,
  include_event_history BOOLEAN DEFAULT false,

  -- Weights for ideology calculation (must sum to ~1.0)
  inertia_weight NUMERIC DEFAULT 0.4 CHECK (inertia_weight >= 0 AND inertia_weight <= 1),
  member_weight NUMERIC DEFAULT 0.3 CHECK (member_weight >= 0 AND member_weight <= 1),
  action_weight NUMERIC DEFAULT 0.2 CHECK (action_weight >= 0 AND action_weight <= 1),
  text_weight NUMERIC DEFAULT 0.1 CHECK (text_weight >= 0 AND text_weight <= 1),
  event_weight NUMERIC DEFAULT 0.0 CHECK (event_weight >= 0 AND event_weight <= 1),

  -- Validation: weights sum to approximately 1.0 (allowing for floating point rounding)
  CONSTRAINT weights_sum_to_one CHECK (
    (inertia_weight + member_weight + action_weight + text_weight + event_weight) >= 0.99
    AND (inertia_weight + member_weight + action_weight + text_weight + event_weight) <= 1.01
  ),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideology_inputs_community
  ON community_ideology_inputs(community_id);

-- Function to auto-create inputs record when new community created
CREATE OR REPLACE FUNCTION create_ideology_inputs_for_community()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_ideology_inputs (community_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_ideology_inputs ON communities;
CREATE TRIGGER trigger_create_ideology_inputs
AFTER INSERT ON communities
FOR EACH ROW
EXECUTE FUNCTION create_ideology_inputs_for_community();

-- ============================================================================
-- 4. COMMUNITY RELIGIONS TABLE (New)
-- Stores AI-generated religion/ideology narratives
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_religions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID UNIQUE NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Core identity
  name TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,

  -- Ideology snapshot at time of creation (for drift tracking)
  ideology_snapshot JSONB NOT NULL,

  -- Derived from ideology vector
  core_tenets TEXT[] DEFAULT '{}',
  sacred_values TEXT[] DEFAULT '{}',
  forbidden_actions TEXT[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_religions_community
  ON community_religions(community_id);

-- ============================================================================
-- 5. UTILITY FUNCTIONS
-- ============================================================================

-- Helper function: Merge identity vectors with weights
CREATE OR REPLACE FUNCTION merge_identity_vectors(
  vectors JSONB[],
  weights NUMERIC[]
)
RETURNS JSONB AS $$
DECLARE
  axes TEXT[] := ARRAY['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'];
  result JSONB := '{}'::jsonb;
  axis TEXT;
  weighted_sum NUMERIC;
  weight_sum NUMERIC;
  i INTEGER;
BEGIN
  -- Ensure weights array is same length as vectors
  IF array_length(vectors, 1) != array_length(weights, 1) THEN
    RAISE EXCEPTION 'vectors and weights arrays must have same length';
  END IF;

  -- For each axis, calculate weighted average
  FOREACH axis IN ARRAY axes LOOP
    weighted_sum := 0;
    weight_sum := 0;

    FOR i IN 1..array_length(vectors, 1) LOOP
      IF vectors[i] IS NOT NULL THEN
        weighted_sum := weighted_sum + (vectors[i]->>axis)::NUMERIC * weights[i];
        weight_sum := weight_sum + weights[i];
      END IF;
    END LOOP;

    IF weight_sum > 0 THEN
      result := jsonb_set(
        result,
        ARRAY[axis],
        to_jsonb((weighted_sum / weight_sum)::NUMERIC)
      );
    ELSE
      result := jsonb_set(result, ARRAY[axis], '0'::jsonb);
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Calculate vector distance (Euclidean)
CREATE OR REPLACE FUNCTION vector_distance(
  v1 JSONB,
  v2 JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  axes TEXT[] := ARRAY['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'];
  axis TEXT;
  sum_sq NUMERIC := 0;
BEGIN
  FOREACH axis IN ARRAY axes LOOP
    sum_sq := sum_sq + POWER((v1->>axis)::NUMERIC - (v2->>axis)::NUMERIC, 2);
  END LOOP;

  RETURN SQRT(sum_sq);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Calculate cosine similarity
CREATE OR REPLACE FUNCTION cosine_similarity(
  v1 JSONB,
  v2 JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  axes TEXT[] := ARRAY['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'];
  axis TEXT;
  dot_product NUMERIC := 0;
  magnitude_a NUMERIC := 0;
  magnitude_b NUMERIC := 0;
BEGIN
  FOREACH axis IN ARRAY axes LOOP
    dot_product := dot_product + (v1->>axis)::NUMERIC * (v2->>axis)::NUMERIC;
    magnitude_a := magnitude_a + POWER((v1->>axis)::NUMERIC, 2);
    magnitude_b := magnitude_b + POWER((v2->>axis)::NUMERIC, 2);
  END LOOP;

  magnitude_a := SQRT(magnitude_a);
  magnitude_b := SQRT(magnitude_b);

  IF magnitude_a = 0 OR magnitude_b = 0 THEN
    RETURN 0;
  END IF;

  RETURN dot_product / (magnitude_a * magnitude_b);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. INITIALIZATION: Populate identity for existing bots
-- ============================================================================

-- Define archetypes mapping
CREATE TEMP TABLE temp_archetypes (
  name TEXT,
  vector JSONB
);

INSERT INTO temp_archetypes VALUES
('Warrior', '{"order_chaos":0.7,"self_community":0.2,"logic_emotion":-0.5,"power_harmony":0.8,"tradition_innovation":-0.3}'::jsonb),
('Diplomat', '{"order_chaos":-0.3,"self_community":0.8,"logic_emotion":0.6,"power_harmony":-0.6,"tradition_innovation":0.4}'::jsonb),
('Sage', '{"order_chaos":0.5,"self_community":-0.3,"logic_emotion":0.9,"power_harmony":-0.2,"tradition_innovation":0.7}'::jsonb),
('Caregiver', '{"order_chaos":-0.2,"self_community":0.9,"logic_emotion":-0.4,"power_harmony":-0.7,"tradition_innovation":-0.3}'::jsonb),
('Lover', '{"order_chaos":-0.6,"self_community":0.5,"logic_emotion":-0.8,"power_harmony":-0.5,"tradition_innovation":0.6}'::jsonb),
('Rebel', '{"order_chaos":-0.9,"self_community":-0.4,"logic_emotion":0.2,"power_harmony":0.3,"tradition_innovation":0.9}'::jsonb),
('Magician', '{"order_chaos":0.4,"self_community":-0.5,"logic_emotion":0.7,"power_harmony":0.5,"tradition_innovation":0.8}'::jsonb),
('Ruler', '{"order_chaos":0.8,"self_community":0.3,"logic_emotion":0.5,"power_harmony":0.9,"tradition_innovation":0.2}'::jsonb);

-- Assign random archetypes to bots that don't have identity yet
UPDATE users
SET
  identity_json = (
    SELECT vector FROM temp_archetypes
    ORDER BY RANDOM()
    LIMIT 1
  ),
  identity_label = (
    SELECT name FROM temp_archetypes
    ORDER BY RANDOM()
    LIMIT 1
  )
WHERE is_bot = true AND identity_json->'order_chaos' IS NULL;

-- ============================================================================
-- 7. INITIALIZATION: Set community ideology to founder's identity
-- ============================================================================

UPDATE communities c
SET ideology_json = u.identity_json
FROM community_members cm
JOIN users u ON cm.user_id = u.id
WHERE c.id = cm.community_id
  AND cm.rank_tier = 0  -- Sovereign/Founder
  AND c.ideology_json->'order_chaos' IS NULL;

-- Default communities to neutral if no sovereign found
UPDATE communities
SET ideology_json = '{"order_chaos":0,"self_community":0,"logic_emotion":0,"power_harmony":0,"tradition_innovation":0}'::jsonb
WHERE ideology_json->'order_chaos' IS NULL;

-- ============================================================================
-- 8. ENABLE RLS IF NEEDED
-- ============================================================================

ALTER TABLE community_ideology_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_religions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read ideology inputs
CREATE POLICY "Anyone can read ideology inputs"
  ON community_ideology_inputs FOR SELECT
  USING (true);

-- Sovereigns can update their community's ideology inputs
CREATE POLICY "Sovereigns can update ideology inputs"
  ON community_ideology_inputs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = community_ideology_inputs.community_id
        AND cm.rank_tier = 0
        AND u.auth_id = auth.uid()
    )
  );

-- Anyone can read religions
CREATE POLICY "Anyone can read religions"
  ON community_religions FOR SELECT
  USING (true);

-- Sovereigns can update/insert religions
CREATE POLICY "Sovereigns can manage religions"
  ON community_religions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = community_religions.community_id
        AND cm.rank_tier = 0
        AND u.auth_id = auth.uid()
    )
  );
