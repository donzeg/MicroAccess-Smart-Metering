-- Last successful SteamaCo operational views used for fast, resilient page loads.

CREATE TABLE IF NOT EXISTS steama_operational_snapshots (
  provider TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, resource_key)
);

CREATE INDEX IF NOT EXISTS idx_steama_operational_snapshots_retrieved
  ON steama_operational_snapshots (provider, retrieved_at DESC);
