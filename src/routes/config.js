'use strict';
const { Router } = require('express');
const { getConfig, saveConfig } = require('../config');

const router = Router();

router.get('/config', (req, res) => {
  const config = getConfig();
  res.json({
    reposPath:        config.reposPath,
    designSystemPath: config.designSystemPath || '',
    boardId:       config.jira.boardId,
    hasToken:      !!config.jira.apiToken,
    suggestCommit: config.suggestCommit ?? true,
    commitFormat:  config.commitFormat  || '',
  });
});

router.post('/config', (req, res) => {
  saveConfig(req.body);
  res.json({ ok: true });
});

module.exports = router;
