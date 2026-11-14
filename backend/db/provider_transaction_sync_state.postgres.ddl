-- Independent resume cursor for each retained provider transaction ledger.

CREATE TABLE IF NOT EXISTS steama_transaction_sync_state (
  provider TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('UCH', 'PAY')),
  synced_through TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, category)
);
