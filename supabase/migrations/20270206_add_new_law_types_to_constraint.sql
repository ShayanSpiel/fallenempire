-- Add new law types (IMPORT_TARIFF, CFC_ALLIANCE) to the law_type_valid constraint

ALTER TABLE community_proposals DROP CONSTRAINT IF EXISTS law_type_valid;

ALTER TABLE community_proposals ADD CONSTRAINT law_type_valid CHECK (
  law_type IN (
    'DECLARE_WAR',
    'PROPOSE_HEIR',
    'CHANGE_GOVERNANCE',
    'MESSAGE_OF_THE_DAY',
    'WORK_TAX',
    'IMPORT_TARIFF',
    'CFC_ALLIANCE'
  )
);
