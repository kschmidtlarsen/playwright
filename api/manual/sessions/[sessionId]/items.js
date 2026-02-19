const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

  const { sessionId } = req.query;
  const { category, title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const sessionCheck = await pool.query(
      'SELECT 1 FROM manual_test_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const maxResult = await pool.query(
      'SELECT COALESCE(MAX(item_index), -1) as max_index FROM manual_test_items WHERE session_id = $1',
      [sessionId]
    );

    const newIndex = maxResult.rows[0].max_index + 1;

    const result = await pool.query(
      "INSERT INTO manual_test_items (session_id, item_index, category, title, status, is_custom) VALUES ($1, $2, $3, $4, 'pending', true) RETURNING id, item_index, category, title, status, is_custom",
      [sessionId, newIndex, category || 'Custom', title]
    );

    await pool.query(
      'UPDATE manual_test_sessions SET total_items = total_items + 1 WHERE session_id = $1',
      [sessionId]
    );

    const item = result.rows[0];
    return res.status(201).json({
      id: item.id,
      index: item.item_index,
      category: item.category,
      title: item.title,
      status: item.status,
      isCustom: item.is_custom
    });
  } catch (err) {
    console.error('Error adding item:', err);
    return res.status(500).json({ error: 'Failed to add item' });
  }
};
