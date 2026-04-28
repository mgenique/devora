'use strict';
const { Router } = require('express');
const { jiraGet }   = require('../jira');
const { getConfig } = require('../config');

const router = Router();

router.get('/sprint', async (req, res) => {
  try {
    const { jira }  = getConfig();
    const sprints   = await jiraGet(`/rest/agile/1.0/board/${jira.boardId}/sprint?state=active`);
    if (!sprints.values?.length) return res.json({ sprint: null, issues: [] });

    const sprint    = sprints.values[0];
    const fields    = 'summary,status,issuetype,priority,assignee,customfield_10016';
    const issueData = await jiraGet(`/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=100&fields=${fields}`);
    res.json({ sprint, issues: issueData.issues || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
