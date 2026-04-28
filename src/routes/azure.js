'use strict';
const { Router } = require('express');
const { azureOrgGet, azureProjectGet }        = require('../azure');
const { getAzureConfig, saveAzureConfig }     = require('../config');

const router = Router();

function deriveColour(record) {
  const state  = (record.state  || '').toLowerCase();
  const result = (record.result || '').toLowerCase();
  if (state === 'inprogress')                                               return 'blue';
  if (result === 'succeeded' || result === 'partiallysucceeded')            return 'green';
  if (result === 'failed' || result === 'canceled' || result === 'abandoned') return 'red';
  return 'grey';
}

// ── Config ────────────────────────────────────────────────────────────────

router.get('/azure/config', (req, res) => {
  const { orgUrl, pat, watches } = getAzureConfig();
  res.json({ orgUrl: orgUrl || '', hasPat: !!pat, watches: watches || [] });
});

router.post('/azure/config', (req, res) => {
  try {
    saveAzureConfig(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Discovery ─────────────────────────────────────────────────────────────

// List all projects in the org
router.get('/azure/projects', async (req, res) => {
  try {
    const data     = await azureOrgGet('/_apis/projects?api-version=7.0');
    const projects = (data.value || [])
      .map(p => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List repos inside a project
router.get('/azure/repos/:project', async (req, res) => {
  try {
    const data  = await azureProjectGet(req.params.project, '/_apis/git/repositories?api-version=7.0');
    const repos = (data.value || [])
      .map(r => ({ id: r.id, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List branches for a repo inside a project
router.get('/azure/branches/:project/:repoId', async (req, res) => {
  try {
    const data     = await azureProjectGet(
      req.params.project,
      `/_apis/git/repositories/${req.params.repoId}/refs?filter=heads/&api-version=7.0`
    );
    const branches = (data.value || [])
      .map(r => r.name.replace('refs/heads/', ''))
      .sort();
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Status ────────────────────────────────────────────────────────────────

// Build stage statuses for all watched project/repo/branch combos
router.get('/azure/status', async (req, res) => {
  const { watches, orgUrl } = getAzureConfig();
  if (!watches?.length || !orgUrl) return res.json([]);

  const results = [];

  for (const watch of watches) {
    try {
      const buildsData = await azureProjectGet(
        watch.project,
        `/_apis/build/builds?repositoryId=${watch.repoId}` +
        `&repositoryType=TfsGit` +
        `&branchName=refs/heads/${encodeURIComponent(watch.branch)}` +
        `&$top=1&queryOrder=queueTimeDescending&api-version=7.0`
      );

      const build = buildsData.value?.[0];
      if (!build) {
        results.push({ repoName: watch.repoName, branch: watch.branch, buildId: null, buildUrl: null, stages: null });
        continue;
      }

      const buildUrl = `${orgUrl}/${encodeURIComponent(watch.project)}/_build/results?buildId=${build.id}`;
      const timeline = await azureProjectGet(watch.project, `/_apis/build/builds/${build.id}/timeline?api-version=7.0`);
      const records  = timeline.records || [];

      let stageRecords = records.filter(r => r.type === 'Stage');
      if (!stageRecords.length) stageRecords = records.filter(r => r.type === 'Job');
      stageRecords.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      results.push({
        repoName: watch.repoName,
        branch:   watch.branch,
        buildId:  build.id,
        buildUrl,
        stages:   stageRecords.map(r => ({ name: r.name, colour: deriveColour(r) })),
      });
    } catch (_) {
      results.push({ repoName: watch.repoName, branch: watch.branch, buildId: null, buildUrl: null, stages: null });
    }
  }

  res.json(results);
});

module.exports = router;
