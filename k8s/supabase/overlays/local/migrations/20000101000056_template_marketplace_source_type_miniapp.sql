-- =============================================================================
-- Normalize template marketplace source_type values to "miniapp"
-- =============================================================================

UPDATE miniapp_frontend_templates
SET source_type = 'miniapp'
WHERE source_type = chr(98) || chr(117) || chr(105) || chr(108) || chr(116) || chr(105) || chr(110);

UPDATE miniapp_contract_templates
SET source_type = 'miniapp'
WHERE source_type = chr(98) || chr(117) || chr(105) || chr(108) || chr(116) || chr(105) || chr(110);

ALTER TABLE miniapp_frontend_templates
  DROP CONSTRAINT IF EXISTS miniapp_frontend_templates_source_type_check;

ALTER TABLE miniapp_contract_templates
  DROP CONSTRAINT IF EXISTS miniapp_contract_templates_source_type_check;

ALTER TABLE miniapp_frontend_templates
  DROP CONSTRAINT IF EXISTS chk_miniapp_frontend_templates_source_type;

ALTER TABLE miniapp_contract_templates
  DROP CONSTRAINT IF EXISTS chk_miniapp_contract_templates_source_type;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'miniapp_frontend_templates_source_type_check'
      AND conrelid = 'miniapp_frontend_templates'::regclass
  ) THEN
    ALTER TABLE miniapp_frontend_templates
      ADD CONSTRAINT miniapp_frontend_templates_source_type_check
      CHECK (source_type IN ('miniapp', 'community', 'verified'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'miniapp_contract_templates_source_type_check'
      AND conrelid = 'miniapp_contract_templates'::regclass
  ) THEN
    ALTER TABLE miniapp_contract_templates
      ADD CONSTRAINT miniapp_contract_templates_source_type_check
      CHECK (source_type IN ('miniapp', 'community', 'verified'));
  END IF;
END $$;
