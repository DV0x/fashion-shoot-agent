-- Fashion Shoot Agent - D1 Database Schema
-- Run: npx wrangler d1 execute fashion-shoot-sessions --file=schema.sql

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error', 'expired')),
  pipeline_stage TEXT DEFAULT 'init',
  sdk_session_id TEXT,
  total_cost_usd REAL DEFAULT 0,
  total_turns INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSON
);

-- Session assets tracking
CREATE TABLE IF NOT EXISTS session_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('input', 'hero', 'contact-sheet', 'frame', 'clip', 'final')),
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Checkpoints for human-in-loop control
CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('hero', 'contact-sheet', 'frames', 'clips', 'complete')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  artifact_keys JSON,
  message TEXT,
  user_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_session ON session_assets(session_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON session_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON checkpoints(status);
