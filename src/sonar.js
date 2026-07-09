'use strict';
const http            = require('http');
const https           = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { getConfig, getSonarConfig } = require('./config');

const proxyAgent = (() => {
  const cfg = getConfig();
  return cfg.proxy ? new HttpsProxyAgent(cfg.proxy) : null;
})();

function sonarRequest(urlPath) {
  const { baseUrl, token } = getSonarConfig();
  if (!baseUrl) throw new Error('SonarQube base URL not configured');

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url  = new URL(base + urlPath);
  const isHttps = url.protocol === 'https:';
  const auth    = Buffer.from(`${token || ''}:`).toString('base64');

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      headers:  { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      ...(isHttps && proxyAgent && { agent: proxyAgent }),
    };

    (isHttps ? https : http).get(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`SonarQube HTTP ${res.statusCode} — ${data.slice(0, 400)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`SonarQube parse error — ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

module.exports = { sonarRequest };
