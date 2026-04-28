'use strict';
const https            = require('https');
const HttpsProxyAgent  = require('https-proxy-agent');
const { getConfig, getJiraAuth } = require('./config');

const proxyAgent = (() => {
  const cfg = getConfig();
  return cfg.proxy ? new HttpsProxyAgent(cfg.proxy) : null;
})();

function jiraGet(urlPath) {
  return new Promise((resolve, reject) => {
    const { jira } = getConfig();
    const fullUrl  = new URL(jira.baseUrl + urlPath);
    https.get({
      hostname: fullUrl.hostname,
      path:     fullUrl.pathname + fullUrl.search,
      headers:  { Authorization: `Basic ${getJiraAuth()}`, Accept: 'application/json' },
      ...(proxyAgent && { agent: proxyAgent }),
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Jira parse error: ${data.slice(0, 300)}`)); }
      });
    }).on('error', reject);
  });
}

function jiraFetchRaw(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const fullUrl = new URL(url);
    https.get({
      hostname: fullUrl.hostname,
      path:     fullUrl.pathname + fullUrl.search,
      headers:  { Authorization: `Basic ${getJiraAuth()}` },
      ...(proxyAgent && { agent: proxyAgent }),
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return jiraFetchRaw(res.headers.location, redirects - 1).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        buffer:      Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'application/octet-stream',
      }));
    }).on('error', reject);
  });
}

function adfToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  const inner = node.content.map(adfToText).join('');
  switch (node.type) {
    case 'paragraph':  return inner + '\n';
    case 'heading':    return `${'#'.repeat(node.attrs?.level || 2)} ${inner}\n`;
    case 'listItem':   return `- ${inner.trim()}\n`;
    case 'codeBlock':  return `\`\`\`\n${inner}\`\`\`\n`;
    case 'hardBreak':  return '\n';
    default:           return inner;
  }
}

module.exports = { jiraGet, jiraFetchRaw, adfToText };
