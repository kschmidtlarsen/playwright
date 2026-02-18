const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get latest run for each project
    const result = await pool.query(`
      SELECT DISTINCT ON (project_id)
        project_id,
        run_id,
        timestamp,
        stats_total,
        stats_passed,
        stats_failed,
        stats_skipped,
        stats_duration,
        exit_code
      FROM test_runs
      ORDER BY project_id, timestamp DESC
    `);

    // Get project names
    const projects = await pool.query('SELECT id, name FROM projects');
    const projectNames = {};
    projects.rows.forEach(p => { projectNames[p.id] = p.name; });

    // Build summary
    const summary = {};
    result.rows.forEach(row => {
      summary[row.project_id] = {
        name: projectNames[row.project_id] || row.project_id,
        lastRun: {
          id: row.run_id,
          timestamp: row.timestamp,
          stats: {
            total: row.stats_total,
            passed: row.stats_passed,
            failed: row.stats_failed,
            skipped: row.stats_skipped,
            duration: row.stats_duration
          }
        },
        passed: row.stats_passed,
        failed: row.stats_failed,
        skipped: row.stats_skipped,
        total: row.stats_total,
        status: row.stats_failed > 0 ? 'failed' : row.stats_passed > 0 ? 'passed' : 'unknown'
      };
    });

    // Add projects with no runs
    projects.rows.forEach(p => {
      if (!summary[p.id]) {
        summary[p.id] = {
          name: p.name,
          lastRun: null,
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          status: 'unknown'
        };
      }
    });

    res.json(summary);
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ error: 'Failed to fetch results', details: err.message });
  }
};
