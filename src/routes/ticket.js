'use strict';
const { Router } = require('express');
const { jiraGet } = require('../jira');

const router = Router();

router.get('/ticket/:key', async (req, res) => {
  try {
    const issue = await jiraGet(`/rest/api/3/issue/${req.params.key}?expand=renderedFields`);
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
