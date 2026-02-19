const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MIGRATION_SQL = `
-- Manual Test Sessions table
CREATE TABLE IF NOT EXISTS manual_test_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) UNIQUE NOT NULL,
  project_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  passed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  skipped_items INTEGER DEFAULT 0,
  created_by VARCHAR(100),
  notes TEXT
);

-- Manual Test Items table
CREATE TABLE IF NOT EXISTS manual_test_items (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) NOT NULL REFERENCES manual_test_sessions(session_id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  category VARCHAR(100),
  title TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_description TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  tested_at TIMESTAMPTZ,
  kanban_card_id VARCHAR(50),
  UNIQUE(session_id, item_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manual_sessions_project ON manual_test_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_manual_sessions_status ON manual_test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_manual_items_session ON manual_test_items(session_id);
CREATE INDEX IF NOT EXISTS idx_manual_items_category ON manual_test_items(session_id, category);
`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check - require a secret header
  const authHeader = req.headers['x-migration-key'];
  if (authHeader !== 'run-migration-2024') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query(MIGRATION_SQL);
    return res.json({
      success: true,
      message: 'Migration completed successfully',
      tables: ['manual_test_sessions', 'manual_test_items']
    });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({
      error: 'Migration failed',
      details: err.message
    });
  }
};
