-- MSM Phase 1 read-only integration foundation

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  default_currency CHAR(3) NOT NULL,
  default_timezone TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('planned', 'active', 'suspended', 'decommissioned')),
  commissioned_at TIMESTAMPTZ NULL,
  decommissioned_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_tenant_state ON sites (tenant_id, state);

CREATE TABLE IF NOT EXISTS utilities (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 12),
  register_behavior TEXT NOT NULL CHECK (register_behavior IN ('cumulative', 'interval', 'mixed')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS integration_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  base_url TEXT NOT NULL,
  secret_reference TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  site_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, provider, environment)
);

CREATE TABLE IF NOT EXISTS integration_runs (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  run_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'partially_succeeded', 'failed')),
  correlation_id TEXT NOT NULL,
  provider_release TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  safe_error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (integration_account_id, correlation_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_runs_account_created
  ON integration_runs (integration_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_attempts (
  id UUID PRIMARY KEY,
  integration_run_id UUID NOT NULL REFERENCES integration_runs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  request_path TEXT NOT NULL,
  page_cursor TEXT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  state TEXT NOT NULL CHECK (state IN ('started', 'succeeded', 'failed', 'retry_pending')),
  http_status INTEGER NULL,
  safe_error_code TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  UNIQUE (integration_run_id, resource_type, request_path, attempt_number)
);

CREATE TABLE IF NOT EXISTS provider_snapshots (
  id UUID PRIMARY KEY,
  integration_run_id UUID NOT NULL REFERENCES integration_runs(id),
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  provider_resource_id TEXT NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  protected_payload_reference TEXT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  parsing_state TEXT NOT NULL CHECK (parsing_state IN ('pending', 'parsed', 'rejected')),
  UNIQUE (provider, resource_type, provider_resource_id, checksum_sha256)
);

CREATE INDEX IF NOT EXISTS idx_provider_snapshots_resource_observed
  ON provider_snapshots (provider, resource_type, provider_resource_id, last_observed_at DESC);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  identity_reference TEXT NOT NULL,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('person', 'organisation')),
  state TEXT NOT NULL CHECK (state IN ('prospect', 'active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, identity_reference)
);

CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  account_number TEXT NOT NULL,
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('prepaid', 'postpaid', 'excluded', 'undecided')),
  currency CHAR(3) NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'suspended', 'closed', 'archived')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, account_number),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS meters (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  utility_id UUID NOT NULL REFERENCES utilities(id),
  serial_reference TEXT NOT NULL,
  asset_reference TEXT NULL,
  manufacturer TEXT NULL,
  model TEXT NULL,
  phase TEXT NULL,
  lifecycle_state TEXT NOT NULL CHECK (
    lifecycle_state IN ('discovered', 'installed', 'commissioned', 'active', 'suspended', 'removed', 'retired', 'unknown')
  ),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, serial_reference)
);

CREATE TABLE IF NOT EXISTS meter_installations (
  id UUID PRIMARY KEY,
  meter_id UUID NOT NULL REFERENCES meters(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  location_reference TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL,
  removed_at TIMESTAMPTZ NULL,
  opening_register NUMERIC(24,9) NULL,
  closing_register NUMERIC(24,9) NULL,
  evidence_reference TEXT NOT NULL,
  commissioning_state TEXT NOT NULL CHECK (commissioning_state IN ('pending', 'passed', 'failed', 'not_applicable')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (removed_at IS NULL OR removed_at > installed_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_installations_one_current
  ON meter_installations (meter_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS meter_assignments (
  id UUID PRIMARY KEY,
  meter_id UUID NOT NULL REFERENCES meters(id),
  service_account_id UUID NOT NULL REFERENCES service_accounts(id),
  assignment_kind TEXT NOT NULL CHECK (assignment_kind IN ('primary', 'secondary', 'non_billable')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NULL,
  state TEXT NOT NULL CHECK (state IN ('proposed', 'approved', 'rejected', 'closed')),
  reason TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  approved_by TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  evidence_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK ((state = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR state <> 'approved')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_assignments_one_current_billable_meter
  ON meter_assignments (meter_id)
  WHERE effective_to IS NULL AND state = 'approved' AND assignment_kind IN ('primary', 'secondary');

CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_assignments_one_current_primary_account
  ON meter_assignments (service_account_id)
  WHERE effective_to IS NULL AND state = 'approved' AND assignment_kind = 'primary';

CREATE TABLE IF NOT EXISTS meter_topology_links (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  meter_id UUID NOT NULL REFERENCES meters(id),
  parent_meter_id UUID NULL REFERENCES meters(id),
  meter_role TEXT NOT NULL CHECK (
    meter_role IN (
      'customer_load', 'grid_source', 'solar_source', 'generator_source',
      'distribution_or_bulk', 'spare', 'retired', 'test', 'unknown'
    )
  ),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NULL,
  evidence_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (parent_meter_id IS NULL OR parent_meter_id <> meter_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_topology_one_current_role
  ON meter_topology_links (meter_id) WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS provider_mappings (
  id UUID PRIMARY KEY,
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  internal_entity_type TEXT NOT NULL,
  internal_entity_id UUID NOT NULL,
  provider_resource_type TEXT NOT NULL,
  provider_resource_id TEXT NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  missing_since TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (integration_account_id, provider_resource_type, provider_resource_id),
  UNIQUE (integration_account_id, internal_entity_type, internal_entity_id, provider_resource_type)
);

CREATE TABLE IF NOT EXISTS readiness_exceptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  site_id UUID NULL REFERENCES sites(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  exception_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  state TEXT NOT NULL CHECK (state IN ('open', 'investigating', 'resolved', 'accepted')),
  owner_reference TEXT NULL,
  evidence_reference TEXT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolution TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, entity_type, entity_id, exception_type)
);

CREATE INDEX IF NOT EXISTS idx_readiness_exceptions_queue
  ON readiness_exceptions (tenant_id, site_id, state, severity, last_detected_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NULL REFERENCES tenants(id),
  actor_reference TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  result TEXT NOT NULL CHECK (result IN ('succeeded', 'denied', 'failed')),
  correlation_id TEXT NOT NULL,
  safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_scope_time
  ON audit_events (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id UUID PRIMARY KEY,
  tenant_id UUID NULL REFERENCES tenants(id),
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'processing', 'published', 'failed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NULL,
  last_safe_error_code TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_messages_dispatch
  ON outbox_messages (state, available_at) WHERE state IN ('pending', 'failed');
