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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId } = req.query;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const { stats, suites, errors, source } = req.body;

  if (!stats || typeof stats !== 'object') {
    return res.status(400).json({ error: 'Invalid stats object' });
  }

  try {
    const runId = Date.now().toString();

    await pool.query(`
      INSERT INTO test_runs (
        project_id, run_id, timestamp,
        stats_total, stats_passed, stats_failed, stats_skipped, stats_duration,
        source, exit_code, suites, errors
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      projectId,
      runId,
      stats.total || 0,
      stats.passed || 0,
      stats.failed || 0,
      stats.skipped || 0,
      stats.duration || 0,
      source || 'ci-upload',
      stats.failed > 0 ? 1 : 0,
      JSON.stringify(suites || []),
      JSON.stringify(errors || [])
    ]);

    // Ensure project exists
    await pool.query(`
      INSERT INTO projects (id, name)
      VALUES ($1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [projectId]);

    // Clean up old runs (keep last 50 per project)
    await pool.query(`
      DELETE FROM test_runs
      WHERE project_id = $1
      AND id NOT IN (
        SELECT id FROM test_runs
        WHERE project_id = $1
        ORDER BY timestamp DESC
        LIMIT 50
      )
    `, [projectId]);

    const run = {
      id: runId,
      timestamp: new Date().toISOString(),
      stats: {
        total: stats.total || 0,
        passed: stats.passed || 0,
        failed: stats.failed || 0,
        skipped: stats.skipped || 0,
        duration: stats.duration || 0
      },
      source: source || 'ci-upload',
      exitCode: stats.failed > 0 ? 1 : 0
    };

    console.log(`Results uploaded for ${projectId}: ${run.stats.passed}/${run.stats.total} passed`);
    res.json({ message: 'Results uploaded', run });
  } catch (err) {
    console.error('Error uploading results:', err);
    res.status(500).json({ error: 'Failed to upload results', details: err.message });
  }
};
