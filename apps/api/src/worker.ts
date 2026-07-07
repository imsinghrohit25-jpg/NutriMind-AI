import 'dotenv/config';
import { initTelemetry } from './telemetry/otel.js';
import { env } from './env.js';
import { startAllWorkers } from './jobs/registry.js';
import { getBoss, shutdownBoss } from './jobs/boss.js';

initTelemetry({
  serviceName: `${env.OTEL_SERVICE_NAME}-worker`,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  prometheusPort: 9465,
});

console.log('[worker] Starting pg-boss workers...');

await getBoss();
await startAllWorkers();

console.log('[worker] All workers started. Waiting for jobs...');

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — shutting down gracefully`);
  await shutdownBoss();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
