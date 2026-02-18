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

  const { since } = req.query;

  try {
    const result = await pool.query('SELECT MAX(timestamp) as latest FROM test_runs');
    const latest = result.rows[0]?.latest;
    const hasUpdates = since ? new Date(latest) > new Date(since) : false;

    res.json({
      latest: latest?.toISOString() || null,
      hasUpdates
    });
  } catch (err) {
    console.error('Error polling:', err);
    res.status(500).json({ error: 'Failed to poll', details: err.message });
  }
};
