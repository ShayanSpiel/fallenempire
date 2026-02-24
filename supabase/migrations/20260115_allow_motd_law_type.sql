-- Extend the community proposal law type whitelist for MESSAGE_OF_THE_DAY
ALTER TABLE public.community_proposals
  DROP CONSTRAINT IF EXISTS law_type_valid;
ALTER TABLE public.community_proposals
  ADD CONSTRAINT law_type_valid CHECK (
    law_type IN (
      'DECLARE_WAR',
      'PROPOSE_HEIR',
      'CHANGE_GOVERNANCE',
      'MESSAGE_OF_THE_DAY'
    )
  );
