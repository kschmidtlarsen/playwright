const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const KANBAN_API = 'https://kanban.exe.pm/api/board';

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

  try {
    const sessionResult = await pool.query(
      'SELECT session_id, project_id, started_at FROM manual_test_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    const failedResult = await pool.query(
      "SELECT id, category, title, error_description FROM manual_test_items WHERE session_id = $1 AND status = 'failed' ORDER BY category, item_index",
      [sessionId]
    );

    if (failedResult.rows.length === 0) {
      return res.json({ message: 'No failed items', cards: [] });
    }

    const groupedFailures = {};
    for (const item of failedResult.rows) {
      const cat = item.category || 'Uncategorized';
      if (!groupedFailures[cat]) {
        groupedFailures[cat] = [];
      }
      groupedFailures[cat].push(item);
    }

    const categoryTotals = {};
    const totalsResult = await pool.query(
      "SELECT category, COUNT(*) as total, SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed FROM manual_test_items WHERE session_id = $1 GROUP BY category",
      [sessionId]
    );

    for (const row of totalsResult.rows) {
      categoryTotals[row.category || 'Uncategorized'] = {
        total: parseInt(row.total, 10),
        passed: parseInt(row.passed, 10),
        failed: parseInt(row.failed, 10)
      };
    }

    const createdCards = [];

    for (const [category, items] of Object.entries(groupedFailures)) {
      const failCount = items.length;
      const totals = categoryTotals[category] || { total: failCount, passed: 0, failed: failCount };

      let description = '## Manual Test Failures\n\n';
      description += '**Project:** ' + session.project_id + '\n';
      description += '**Category:** ' + category + '\n';
      description += '**Session:** ' + session.session_id + '\n';
      description += '**Tested:** ' + new Date(session.started_at).toISOString() + '\n\n';
      description += '---\n\n### Failed Tests\n\n';

      for (const item of items) {
        description += '#### X ' + item.title + '\n';
        description += '**Error:** ' + item.error_description + '\n\n';
      }

      description += '---\n\n### Session Summary\n';
      description += '- Total in category: ' + totals.total + '\n';
      description += '- Passed: ' + totals.passed + '\n';
      description += '- Failed: ' + totals.failed + '\n';

      const cardTitle = 'BUG: ' + category + ' - ' + failCount + ' test failure' + (failCount > 1 ? 's' : '');

      try {
        const response = await fetch(KANBAN_API + '/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cardTitle,
            description: description,
            projectId: session.project_id,
            columnId: 'backlog',
            priority: 'high',
            type: 'bug'
          })
        });

        if (response.ok) {
          const cardData = await response.json();
          createdCards.push({
            category,
            failCount,
            cardId: cardData.id,
            cardUrl: 'https://kanban.exe.pm/card/' + cardData.id
          });

          const itemIds = items.map(i => i.id);
          await pool.query(
            'UPDATE manual_test_items SET kanban_card_id = $1 WHERE id = ANY($2::int[])',
            [cardData.id, itemIds]
          );
        } else {
          const errorText = await response.text();
          console.error('Failed to create Kanban card:', errorText);
          createdCards.push({
            category,
            failCount,
            error: 'Failed to create card'
          });
        }
      } catch (fetchErr) {
        console.error('Error calling Kanban API:', fetchErr);
        createdCards.push({
          category,
          failCount,
          error: fetchErr.message
        });
      }
    }

    return res.json({
      message: 'Created ' + createdCards.filter(c => c.cardId).length + ' bug cards',
      cards: createdCards
    });
  } catch (err) {
    console.error('Error generating report:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};
