const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 8000;
const ENV = process.env.NODE_ENV || 'development';

const log = (level, message, extra = {}) => {
  console.log(JSON.stringify({
    level,
    message,
    service: 'api',
    environment: ENV,
    timestamp: new Date().toISOString(),
    ...extra,
  }));
};

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

app.use(express.json());

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: req.path, status_code: res.statusCode };
    end(labels);
    httpRequestTotal.inc(labels);
    log('info', 'request', { method: req.method, path: req.path, status: res.statusCode });
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api',
    environment: ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (req, res) => {
  res.json({ message: 'Agnos API is running', version: '1.0.0' });
});

// Only start server if this file is run directly
// NOT when imported by tests
if (require.main === module) {
  app.listen(PORT, () => {
    log('info', `API started on port ${PORT}`, { port: PORT });
  });
}

module.exports = app;