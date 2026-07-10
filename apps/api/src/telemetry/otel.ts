import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

export function initTelemetry(opts: {
  serviceName: string;
  otlpEndpoint: string;
  prometheusPort?: number;
}): void {
  if (sdk) return;

  const traceExporter = new OTLPTraceExporter({
    url: `${opts.otlpEndpoint}/v1/traces`,
  });

  const metricReader = new PrometheusExporter({
    port: opts.prometheusPort ?? 9464,
    preventServerStart: false,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: opts.serviceName,
      [ATTR_SERVICE_VERSION]: '0.1.0',
    }),
    traceExporter,
    metricReader,
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
  });

  sdk.start();

  process.on('SIGTERM', async () => {
    await sdk?.shutdown();
  });
}

export function getActiveTraceId(): string {
  const span = trace.getActiveSpan();
  if (!span) return crypto.randomUUID();
  const ctx = span.spanContext();
  return ctx.traceId || crypto.randomUUID();
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
