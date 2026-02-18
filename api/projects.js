let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  console.error('Failed to load pg module:', e);
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check if pg module loaded
  if (!Pool) {
    return res.status(500).json({ error: 'pg module not available' });
  }

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  let pool;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const result = await pool.query(
      'SELECT id, name, base_url, port FROM projects ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({
      error: 'Failed to fetch projects',
      details: err.message,
      stack: err.stack
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
};
