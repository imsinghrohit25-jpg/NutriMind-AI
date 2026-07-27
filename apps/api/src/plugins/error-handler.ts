import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { GatewayError, OutputPolicyViolationError, AllProvidersFailedError } from '../gateway/errors.js';

// Phase 3B — error tracking through the SAME OTEL pipeline telemetry/otel.ts already runs (OTLP
// traces + Prometheus metric reader). No parallel error-tracking mechanism invented; the counter
// carries only static error codes / status (never PII), and 5xx (server/dependency) failures also
// record the exception on the active span so it surfaces in traces and any connected APM.
const httpErrors = metrics
  .getMeter('nutrimind.http')
  .createCounter('nutrimind_http_errors_total', {
    description: 'HTTP error responses emitted by the API, labelled by error code and status class.',
  });

function trackError(code: string, statusCode: number, error: unknown): void {
  httpErrors.add(1, { code, status: statusCode, status_class: `${Math.floor(statusCode / 100)}xx` });
  if (statusCode >= 500) {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR, message: code });
    }
  }
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const requestId = request.id as string;
    const traceId = request.traceId ?? '';

    if (error instanceof ZodError) {
      trackError('VALIDATION_ERROR', 400, error);
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
        },
        meta: { requestId, version: 'v1' },
      });
    }

    if (error instanceof OutputPolicyViolationError) {
      fastify.log.warn({ traceId, violations: error.violations }, 'Output policy violation');
      trackError('OUTPUT_POLICY_VIOLATION', 422, error);
      return reply.status(422).send({
        ok: false,
        error: {
          code: 'OUTPUT_POLICY_VIOLATION',
          message: 'Response blocked by content policy',
        },
        meta: { requestId, version: 'v1' },
      });
    }

    if (error instanceof AllProvidersFailedError) {
      fastify.log.error({ traceId, err: error.message }, 'All LLM providers failed');
      trackError('LLM_UNAVAILABLE', 503, error);
      return reply.status(503).send({
        ok: false,
        error: {
          code: 'LLM_UNAVAILABLE',
          message: 'AI service temporarily unavailable. Please try again shortly.',
        },
        meta: { requestId, version: 'v1' },
      });
    }

    if (error instanceof GatewayError) {
      fastify.log.error({ traceId, code: error.code, provider: error.provider }, error.message);
      const status = error.retryable ? 503 : 500;
      trackError(error.code, status, error);
      return reply.status(status).send({
        ok: false,
        error: { code: error.code, message: error.message },
        meta: { requestId, version: 'v1' },
      });
    }

    const fastifyErr = error as FastifyError;
    if (fastifyErr.statusCode) {
      trackError(fastifyErr.code ?? 'REQUEST_ERROR', fastifyErr.statusCode, error);
      return reply.status(fastifyErr.statusCode).send({
        ok: false,
        error: {
          code: fastifyErr.code ?? 'REQUEST_ERROR',
          message: fastifyErr.message,
        },
        meta: { requestId, version: 'v1' },
      });
    }

    fastify.log.error({ traceId, err: error }, 'Unhandled error');
    trackError('INTERNAL_ERROR', 500, error);
    return reply.status(500).send({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      meta: { requestId, version: 'v1' },
    });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler' });
