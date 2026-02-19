const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { itemId } = req.query;

  if (req.method === 'PATCH') {
    const { status, errorDescription } = req.body;

    const validStatuses = ['pending', 'passed', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (status === 'failed' && !errorDescription) {
      return res.status(400).json({ error: 'Error description required for failed items' });
    }

    try {
      const currentResult = await pool.query(
        'SELECT session_id, status as old_status FROM manual_test_items WHERE id = $1',
        [itemId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const { session_id: sessionId, old_status: oldStatus } = currentResult.rows[0];

      const result = await pool.query(
        'UPDATE manual_test_items SET status = $1, error_description = $2, tested_at = NOW() WHERE id = $3 RETURNING id, item_index, category, title, status, error_description, tested_at',
        [status, status === 'failed' ? errorDescription : null, itemId]
      );

      const item = result.rows[0];

      const counterUpdates = [];
      if (oldStatus === 'passed') counterUpdates.push('passed_items = passed_items - 1');
      if (oldStatus === 'failed') counterUpdates.push('failed_items = failed_items - 1');
      if (oldStatus === 'skipped') counterUpdates.push('skipped_items = skipped_items - 1');

      if (status === 'passed') counterUpdates.push('passed_items = passed_items + 1');
      if (status === 'failed') counterUpdates.push('failed_items = failed_items + 1');
      if (status === 'skipped') counterUpdates.push('skipped_items = skipped_items + 1');

      if (counterUpdates.length > 0) {
        await pool.query(
          'UPDATE manual_test_sessions SET ' + counterUpdates.join(', ') + ' WHERE session_id = $1',
          [sessionId]
        );
      }

      return res.json({
        id: item.id,
        index: item.item_index,
        category: item.category,
        title: item.title,
        status: item.status,
        errorDescription: item.error_description,
        testedAt: item.tested_at
      });
    } catch (err) {
      console.error('Error updating item:', err);
      return res.status(500).json({ error: 'Failed to update item' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const itemResult = await pool.query(
        'SELECT session_id, status, is_custom FROM manual_test_items WHERE id = $1',
        [itemId]
      );

      if (itemResult.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const { session_id: sessionId, status, is_custom: isCustom } = itemResult.rows[0];

      if (isCustom) {
        await pool.query('DELETE FROM manual_test_items WHERE id = $1', [itemId]);

        const counterUpdates = ['total_items = total_items - 1'];
        if (status === 'passed') counterUpdates.push('passed_items = passed_items - 1');
        if (status === 'failed') counterUpdates.push('failed_items = failed_items - 1');
        if (status === 'skipped') counterUpdates.push('skipped_items = skipped_items - 1');

        await pool.query(
          'UPDATE manual_test_sessions SET ' + counterUpdates.join(', ') + ' WHERE session_id = $1',
          [sessionId]
        );

        return res.json({ deleted: true });
      } else {
        await pool.query(
          "UPDATE manual_test_items SET status = 'skipped', tested_at = NOW() WHERE id = $1",
          [itemId]
        );

        const counterUpdates = ['skipped_items = skipped_items + 1'];
        if (status === 'passed') counterUpdates.push('passed_items = passed_items - 1');
        if (status === 'failed') counterUpdates.push('failed_items = failed_items - 1');

        if (status !== 'skipped') {
          await pool.query(
            'UPDATE manual_test_sessions SET ' + counterUpdates.join(', ') + ' WHERE session_id = $1',
            [sessionId]
          );
        }

        return res.json({ skipped: true });
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      return res.status(500).json({ error: 'Failed to delete item' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
