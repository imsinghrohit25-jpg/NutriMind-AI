// Supabase service-role client plugin.
// Decorates fastify with fastify.supabase (service-role client).
// NEVER expose this client to the frontend — service role bypasses RLS.
// Routes that do per-user operations must use auth.uid() via RLS, not service role.

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  fastify.decorate('supabase', client);
  fastify.log.info('[supabase] service-role client initialized');
};

export default fp(supabasePlugin, { name: 'supabase' });
