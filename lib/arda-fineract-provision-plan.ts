import type { ArdaFineractProvisionOptions } from "@/lib/arda-fineract-provision-options";

export const ARDA_FINERACT_TENANT_IDENTIFIER = "arda";
export const ARDA_FINERACT_TENANT_NAME = "ARDA";

type ProvisionPlanInput = Omit<ArdaFineractProvisionOptions, "apply">;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildArdaFineractProvisionPlan(input: ProvisionPlanInput) {
  const registrySql = `WITH source_tenant AS (
  SELECT t.timezone_id, t.country_id, c.*
  FROM tenants t
  JOIN tenant_server_connections c ON c.id = t.oltp_id
  WHERE t.identifier = 'goodfellow'
), inserted_connection AS (
  INSERT INTO tenant_server_connections (
    schema_server, schema_name, schema_server_port, schema_username,
    schema_password, auto_update, pool_initial_size, pool_validation_interval,
    pool_remove_abandoned, pool_remove_abandoned_timeout, pool_log_abandoned,
    pool_abandon_when_percentage_full, pool_test_on_borrow, pool_max_active,
    pool_min_idle, pool_max_idle, pool_suspect_timeout,
    pool_time_between_eviction_runs_millis,
    pool_min_evictable_idle_time_millis, schema_connection_parameters,
    readonly_schema_server, readonly_schema_name, readonly_schema_server_port,
    readonly_schema_username, readonly_schema_password,
    readonly_schema_connection_parameters, master_password_hash
  )
  SELECT
    schema_server, ${sqlLiteral(input.targetDatabase)}, schema_server_port,
    schema_username, schema_password, auto_update, pool_initial_size,
    pool_validation_interval, pool_remove_abandoned,
    pool_remove_abandoned_timeout, pool_log_abandoned,
    pool_abandon_when_percentage_full, pool_test_on_borrow, pool_max_active,
    pool_min_idle, pool_max_idle, pool_suspect_timeout,
    pool_time_between_eviction_runs_millis,
    pool_min_evictable_idle_time_millis, schema_connection_parameters,
    readonly_schema_server, ${sqlLiteral(input.targetDatabase)},
    readonly_schema_server_port, readonly_schema_username,
    readonly_schema_password, readonly_schema_connection_parameters,
    master_password_hash
  FROM source_tenant
  RETURNING id
)
INSERT INTO tenants (
  identifier, name, timezone_id, country_id, joined_date, created_date,
  lastmodified_date, oltp_id, report_id
)
SELECT
  ${sqlLiteral(ARDA_FINERACT_TENANT_IDENTIFIER)},
  ${sqlLiteral(ARDA_FINERACT_TENANT_NAME)},
  source_tenant.timezone_id,
  source_tenant.country_id,
  CURRENT_DATE,
  NOW(),
  NOW(),
  inserted_connection.id,
  inserted_connection.id
FROM source_tenant
CROSS JOIN inserted_connection;`;

  return {
    tenantIdentifier: ARDA_FINERACT_TENANT_IDENTIFIER,
    tenantName: ARDA_FINERACT_TENANT_NAME,
    databasesToCreate: [input.targetDatabase, input.setupDatabase],
    migrationJob: {
      name: "arda-fineract-schema-init",
      namespace: input.namespace,
      image: input.fineractImage,
      environment: {
        SPRING_PROFILES_ACTIVE: "liquibase-only",
        FINERACT_LIQUIBASE_ENABLED: "true",
        FINERACT_MODE_WRITE_ENABLED: "true",
        FINERACT_TENANT_IDENTIFIER: ARDA_FINERACT_TENANT_IDENTIFIER,
        FINERACT_DEFAULT_TENANTDB_IDENTIFIER: ARDA_FINERACT_TENANT_IDENTIFIER,
        FINERACT_DEFAULT_TENANTDB_NAME: input.targetDatabase,
        FINERACT_DEFAULT_TENANTDB_TIMEZONE: "Africa/Harare",
      },
    },
    registrySql,
    verificationQueries: [
      `SELECT identifier, name, timezone_id FROM tenants WHERE identifier = 'arda';`,
      `SELECT COUNT(*) AS core_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('m_client', 'm_loan', 'm_loan_product');`,
    ],
  };
}
