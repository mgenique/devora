'use strict';
const { Router } = require('express');
const { jiraGet } = require('../jira');

const router = Router();

router.get('/boards', async (req, res) => {
  try {
    const boards = [];
    let start = 0;
    while (true) {
      const data = await jiraGet(`/rest/agile/1.0/board?maxResults=50&startAt=${start}`);
      boards.push(...(data.values || []));
      if (data.isLast || boards.length >= data.total) break;
      start += 50;
    }
    boards.sort((a, b) => a.id - b.id);
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
