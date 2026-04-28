'use strict';
const https           = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { getConfig, getAzureConfig } = require('./config');

const proxyAgent = (() => {
  const cfg = getConfig();
  return cfg.proxy ? new HttpsProxyAgent(cfg.proxy) : null;
})();

function getAzureAuth() {
  const { pat } = getAzureConfig();
  return Buffer.from(`:${pat || ''}`).toString('base64');
}

function azureRequest(fullUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);
    https.get({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      headers:  { Authorization: `Basic ${getAzureAuth()}`, Accept: 'application/json' },
      ...(proxyAgent && { agent: proxyAgent }),
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.error(`[Azure] ${res.statusCode} ${url.pathname}`);
        if (res.statusCode >= 400) {
          return reject(new Error(`Azure HTTP ${res.statusCode} — ${data.slice(0, 400)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Azure parse error (${res.statusCode}) — ${data.slice(0, 400)}`)); }
      });
    }).on('error', reject);
  });
}

// Org-level call: https://dev.azure.com/{org}{urlPath}
function azureOrgGet(urlPath) {
  const { orgUrl } = getAzureConfig();
  if (!orgUrl) throw new Error('Azure org URL not configured');
  return azureRequest(`${orgUrl}${urlPath}`);
}

// Project-level call: https://dev.azure.com/{org}/{project}{urlPath}
function azureProjectGet(project, urlPath) {
  const { orgUrl } = getAzureConfig();
  if (!orgUrl) throw new Error('Azure org URL not configured');
  return azureRequest(`${orgUrl}/${encodeURIComponent(project)}${urlPath}`);
}

module.exports = { azureOrgGet, azureProjectGet };
