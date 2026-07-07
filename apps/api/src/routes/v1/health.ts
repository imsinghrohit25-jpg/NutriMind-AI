import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    config: {},
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                version: { type: 'string' },
                uptime: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      ok: true,
      data: {
        status: 'healthy',
        version: '0.1.0',
        uptime: Math.floor(process.uptime()),
      },
    };
  });
};

export default healthRoutes;
