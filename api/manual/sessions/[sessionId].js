const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sessionId } = req.query;

  if (req.method === 'GET') {
    try {
      const sessionResult = await pool.query(
        'SELECT session_id, project_id, status, started_at, completed_at, total_items, passed_items, failed_items, skipped_items, created_by, notes FROM manual_test_sessions WHERE session_id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = sessionResult.rows[0];

      const itemsResult = await pool.query(
        'SELECT id, item_index, category, title, status, error_description, is_custom, tested_at, kanban_card_id FROM manual_test_items WHERE session_id = $1 ORDER BY item_index',
        [sessionId]
      );

      return res.json({
        sessionId: session.session_id,
        projectId: session.project_id,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        totalItems: session.total_items,
        passedItems: session.passed_items,
        failedItems: session.failed_items,
        skippedItems: session.skipped_items,
        createdBy: session.created_by,
        notes: session.notes,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          index: item.item_index,
          category: item.category,
          title: item.title,
          status: item.status,
          errorDescription: item.error_description,
          isCustom: item.is_custom,
          testedAt: item.tested_at,
          kanbanCardId: item.kanban_card_id
        }))
      });
    } catch (err) {
      console.error('Error getting session:', err);
      return res.status(500).json({ error: 'Failed to get session' });
    }
  }

  if (req.method === 'PATCH') {
    const { status, notes } = req.body;

    const validStatuses = ['in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      const updates = [];
      const params = [];

      if (status) {
        params.push(status);
        updates.push('status = $' + params.length);

        if (status === 'completed' || status === 'cancelled') {
          updates.push('completed_at = NOW()');
        }
      }

      if (notes !== undefined) {
        params.push(notes);
        updates.push('notes = $' + params.length);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      params.push(sessionId);
      const query = 'UPDATE manual_test_sessions SET ' + updates.join(', ') + ' WHERE session_id = $' + params.length + ' RETURNING session_id, project_id, status, started_at, completed_at, total_items, passed_items, failed_items, skipped_items, notes';

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = result.rows[0];
      return res.json({
        sessionId: session.session_id,
        projectId: session.project_id,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        totalItems: session.total_items,
        passedItems: session.passed_items,
        failedItems: session.failed_items,
        skippedItems: session.skipped_items,
        notes: session.notes
      });
    } catch (err) {
      console.error('Error updating session:', err);
      return res.status(500).json({ error: 'Failed to update session' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
