import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { GatewayError, OutputPolicyViolationError, AllProvidersFailedError } from '../gateway/errors.js';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const requestId = request.id as string;
    const traceId = request.traceId ?? '';

    if (error instanceof ZodError) {
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
      return reply.status(status).send({
        ok: false,
        error: { code: error.code, message: error.message },
        meta: { requestId, version: 'v1' },
      });
    }

    const fastifyErr = error as FastifyError;
    if (fastifyErr.statusCode) {
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
