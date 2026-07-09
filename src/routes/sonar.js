'use strict';
const { Router } = require('express');
const { getSonarConfig, saveSonarConfig } = require('../config');
const { sonarRequest } = require('../sonar');

const router = Router();

router.get('/sonar/config', (req, res) => {
  const { baseUrl, token, projects } = getSonarConfig();
  res.json({ baseUrl: baseUrl || '', hasToken: !!token, projects: projects || [] });
});

router.post('/sonar/config', (req, res) => {
  try {
    saveSonarConfig(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sonar/coverage', async (req, res) => {
  const { projects } = getSonarConfig();
  if (!projects?.length) return res.json([]);

  const results = await Promise.all(projects.map(async (p) => {
    try {
      const data    = await sonarRequest(`/api/measures/component?component=${encodeURIComponent(p.key)}&metricKeys=coverage`);
      const measure = data.component?.measures?.find(m => m.metric === 'coverage');
      const value   = measure ? parseFloat(measure.value) : null;
      return { name: p.name, key: p.key, coverage: value };
    } catch (err) {
      return { name: p.name, key: p.key, coverage: null, error: err.message };
    }
  }));

  res.json(results);
});

module.exports = router;
