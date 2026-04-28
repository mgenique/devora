'use strict';
const { Router } = require('express');
const { getConfig } = require('../config');
const fs = require('fs');

const router = Router();

router.get('/repos', (req, res) => {
  const { reposPath } = getConfig();
  try {
    const entries = fs.readdirSync(reposPath, { withFileTypes: true });
    res.json(entries.filter(e => e.isDirectory()).map(e => e.name).sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
