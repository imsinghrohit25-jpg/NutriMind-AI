import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../env.js';

export interface AuthUser {
  id: string;
  role: string;
  email?: string;
  aud?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

interface SupabaseJWTPayload extends JWTPayload {
  sub: string;
  role: string;
  email?: string;
  aud?: string | string[];
}

const JWKS = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

async function verifySupabaseJWT(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify<SupabaseJWTPayload>(token, JWKS, {
    issuer: `${env.SUPABASE_URL}/auth/v1`,
  });

  if (!payload.sub) throw new Error('JWT missing sub claim');
  if (!payload.role) throw new Error('JWT missing role claim');

  return {
    id: payload.sub,
    role: payload.role,
    email: payload.email,
    aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
  };
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      request.user = null;
      return;
    }

    const token = auth.slice(7);
    try {
      request.user = await verifySupabaseJWT(token);
    } catch {
      request.user = null;
    }
  });
};

export default fp(authPlugin, { name: 'auth' });

export function requireAuth(request: FastifyRequest): asserts request is FastifyRequest & { user: AuthUser } {
  if (!request.user) {
    throw Object.assign(new Error('Unauthenticated'), { statusCode: 401, code: 'UNAUTHENTICATED' });
  }
}

export function requireServiceRole(request: FastifyRequest): void {
  requireAuth(request);
  if (request.user!.role !== 'service_role') {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
  }
}
