-- D1 schema for the Rancho Trailers costing portal.
--
-- One generic key-value-per-collection table instead of one table per
-- collection: the client already does all filtering/aggregation itself, so
-- the server never needs to query by individual field. This also means a
-- future sub-module (more collections) never needs a schema migration.

CREATE TABLE IF NOT EXISTS documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,        -- JSON-encoded document body
  updated_at TEXT NOT NULL,  -- RFC 3339 UTC timestamp
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  profile_type TEXT NOT NULL,  -- 'master' | 'perfil'
  profile_id TEXT,             -- NULL when profile_type = 'master'
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
