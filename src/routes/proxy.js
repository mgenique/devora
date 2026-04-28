'use strict';
const { Router } = require('express');
const { jiraFetchRaw } = require('../jira');
const { getConfig }    = require('../config');

const router = Router();

router.get('/proxy-image', async (req, res) => {
  let { url } = req.query;
  const { jira } = getConfig();
  if (!url) return res.status(400).end();
  if (url.startsWith('/')) url = jira.baseUrl + url;
  if (!url.startsWith(jira.baseUrl)) return res.status(403).end();
  try {
    const { buffer, contentType } = await jiraFetchRaw(url);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    res.status(502).end();
  }
});

module.exports = router;
