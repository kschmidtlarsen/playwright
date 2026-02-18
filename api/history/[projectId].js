const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function isValidProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(projectId) && projectId.length <= 100;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { projectId } = req.query;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const result = await pool.query(`
      SELECT
        run_id as id,
        timestamp,
        stats_total as total,
        stats_passed as passed,
        stats_failed as failed,
        stats_skipped as skipped,
        stats_duration as duration,
        source,
        exit_code
      FROM test_runs
      WHERE project_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `, [projectId]);

    const runs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      stats: {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        skipped: row.skipped,
        duration: row.duration
      },
      source: row.source,
      exitCode: row.exit_code
    }));

    res.json(runs);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
};
