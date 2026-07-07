import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireServiceRole } from './auth.js';

export type RequiredRole = 'authenticated' | 'service_role';

declare module 'fastify' {
  interface RouteOptions {
    requiredRole?: RequiredRole;
  }
  interface FastifyContextConfig {
    requiredRole?: RequiredRole;
  }
}

const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.routeOptions?.config?.requiredRole as RequiredRole | undefined;
    if (!role) return;

    try {
      if (role === 'service_role') {
        requireServiceRole(request);
      } else {
        requireAuth(request);
      }
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      reply.status(e.statusCode ?? 401).send({
        ok: false,
        error: { code: e.code ?? 'UNAUTHORIZED', message: e.message },
      });
    }
  });
};

export default fp(rbacPlugin, { name: 'rbac', dependencies: ['auth'] });
