import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { trace, context, propagation } from '@opentelemetry/api';
import { getActiveTraceId } from '../telemetry/otel.js';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
  }
}

const otelPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('traceId', '');

  fastify.addHook('onRequest', async (request) => {
    request.traceId = getActiveTraceId();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    reply.header('x-trace-id', request.traceId);
  });
};

export default fp(otelPlugin, { name: 'otel' });
