'use strict';
const fs   = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('config.json not found. Copy config.example.json and fill it in.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let jiraAuth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');

function getConfig()   { return config; }
function getJiraAuth() { return jiraAuth; }

function saveConfig({ reposPath, boardId, apiToken, suggestCommit, commitFormat }) {
  if (reposPath !== undefined)     config.reposPath     = reposPath;
  if (boardId)                     config.jira.boardId  = Number(boardId);
  if (apiToken) {
    config.jira.apiToken = apiToken;
    jiraAuth = Buffer.from(`${config.jira.email}:${apiToken}`).toString('base64');
  }
  if (suggestCommit !== undefined) config.suggestCommit = suggestCommit;
  if (commitFormat  !== undefined) config.commitFormat  = commitFormat;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getAzureConfig() {
  return config.azure || {};
}

// watches entries: { project, repoId, repoName, branch }
function saveAzureConfig({ orgUrl, pat, watches }) {
  if (!config.azure) config.azure = {};
  if (orgUrl  !== undefined) config.azure.orgUrl  = orgUrl;
  if (pat)                   config.azure.pat      = pat;
  if (watches !== undefined) config.azure.watches  = watches;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { getConfig, getJiraAuth, saveConfig, getAzureConfig, saveAzureConfig };
