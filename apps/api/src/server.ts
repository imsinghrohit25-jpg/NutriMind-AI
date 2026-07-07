import { initTelemetry } from './telemetry/otel.js';
import { env } from './env.js';

initTelemetry({
  serviceName: env.OTEL_SERVICE_NAME,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

const { buildApp } = await import('./app.js');

const app = await buildApp();

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(`NutriMind API listening on ${env.API_HOST}:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
