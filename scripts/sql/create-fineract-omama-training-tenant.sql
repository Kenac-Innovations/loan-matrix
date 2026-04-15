-- Creates a real Fineract tenant identifier `omama-training` by aliasing the
-- existing Omama tenant connection in the tenant store.
--
-- Target database: fineract_tenants
-- Safe to run multiple times.
--
-- Why alias instead of cloning the database?
-- - The current Omama training requirement started as a shared-backend setup.
-- - Cloning a live Fineract tenant database is heavier and riskier.
-- - This gives Fineract a first-class `omama-training` identifier while
--   reusing Omama's existing schema/connection details.

INSERT INTO tenants (
  identifier,
  name,
  timezone_id,
  country_id,
  joined_date,
  created_date,
  lastmodified_date,
  oltp_id,
  report_id
)
SELECT
  'omama-training',
  'Omama Training Tenant',
  source.timezone_id,
  source.country_id,
  source.joined_date,
  NOW(),
  NOW(),
  source.oltp_id,
  source.report_id
FROM tenants AS source
WHERE source.identifier = 'omama'
  AND NOT EXISTS (
    SELECT 1
    FROM tenants AS existing
    WHERE existing.identifier = 'omama-training'
  );

-- Verification
SELECT
  t.id,
  t.identifier,
  t.name,
  t.timezone_id,
  t.oltp_id,
  t.report_id,
  ts.schema_name,
  ts.schema_server,
  ts.schema_server_port
FROM tenants t
LEFT JOIN tenant_server_connections ts
  ON t.oltp_id = ts.id
WHERE t.identifier IN ('omama', 'omama-training')
ORDER BY t.identifier;
