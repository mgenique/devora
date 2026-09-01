'use strict';
const express = require('express');
const path    = require('path');
const { getConfig } = require('./src/config');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api', require('./src/routes/sprint'));
app.use('/api', require('./src/routes/ticket'));
app.use('/api', require('./src/routes/proxy'));
app.use('/api', require('./src/routes/config'));
app.use('/api', require('./src/routes/boards'));
app.use('/api', require('./src/routes/repos'));
app.use('/api', require('./src/routes/startDev'));
app.use('/api', require('./src/routes/azure'));
app.use('/api', require('./src/routes/sonar'));

const port = getConfig().port || 3000;
app.listen(port, () => console.log(`Devora → http://localhost:${port}`));
