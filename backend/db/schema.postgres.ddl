-- MSM backend persistence schema

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'initiated',
    'payment_confirmed_credit_pending',
    'credited',
    'failed',
    'reconciled'
  )),
  idempotency_key UUID NOT NULL,
  provider_reference TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_idempotency_key
  ON purchases (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_purchases_state_created_at
  ON purchases (state, created_at);

CREATE TABLE IF NOT EXISTS purchase_transitions (
  id BIGSERIAL PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN (
    'initiated',
    'payment_confirmed_credit_pending',
    'credited',
    'failed',
    'reconciled'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_transitions_purchase_id
  ON purchase_transitions (purchase_id, occurred_at);

CREATE TABLE IF NOT EXISTS purchase_audit_logs (
  id UUID PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_purchase_audit_logs_purchase_id
  ON purchase_audit_logs (purchase_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_meter_map (
  customer_id TEXT NOT NULL,
  meter_id TEXT NOT NULL,
  meter_serial TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (customer_id, meter_id)
);
