const cron = require('node-cron');
const client = require('prom-client');
const http = require('http');

const ENV = process.env.NODE_ENV || 'development';
const METRICS_PORT = process.env.METRICS_PORT || 9091;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '* * * * *';

const log = (level, message, extra = {}) => {
  console.log(JSON.stringify({
    level,
    message,
    service: 'worker',
    environment: ENV,
    timestamp: new Date().toISOString(),
    ...extra,
  }));
};

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const jobSuccessCounter = new client.Counter({
  name: 'worker_jobs_success_total',
  help: 'Total successful worker job runs',
  registers: [register],
});

const jobFailureCounter = new client.Counter({
  name: 'worker_jobs_failure_total',
  help: 'Total failed worker job runs',
  registers: [register],
});

const jobDuration = new client.Histogram({
  name: 'worker_job_duration_seconds',
  help: 'Duration of worker job execution',
  registers: [register],
});

const updateTodayTimestamps = async () => {
  const end = jobDuration.startTimer();
  const today = new Date().toISOString().split('T')[0];

  log('info', 'job started', { job: 'update_timestamps', date: today });

  try {
    // Stubbed: replace with real DB call in production
   
    await new Promise((resolve) => setTimeout(resolve, 200));

    const updatedCount = Math.floor(Math.random() * 100);
    jobSuccessCounter.inc();
    end();

    log('info', 'job completed', {
      job: 'update_timestamps',
      date: today,
      records_updated: updatedCount,
    });
  } catch (err) {
    jobFailureCounter.inc();
    end();
    log('error', 'job failed', {
      job: 'update_timestamps',
      error: err.message,
      stack: err.stack,
    });
  }
};

http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': register.contentType });
    res.end(await register.metrics());
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'worker', environment: ENV }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(METRICS_PORT, () => {
  log('info', `Worker metrics available on port ${METRICS_PORT}`);
});

log('info', 'Worker starting', { schedule: CRON_SCHEDULE });

cron.schedule(CRON_SCHEDULE, updateTodayTimestamps, {
  scheduled: true,
  timezone: process.env.TZ || 'UTC',
});

updateTodayTimestamps();

process.on('SIGTERM', () => { log('info', 'SIGTERM, shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('info', 'SIGINT, shutting down'); process.exit(0); });