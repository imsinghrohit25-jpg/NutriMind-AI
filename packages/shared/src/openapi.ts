import { z } from 'zod';

export const API_VERSION = 'v1';
export const API_TITLE = 'NutriMind AI API';
export const API_DESCRIPTION =
  'AI-powered food intelligence API for the Indian market.';

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
}

export function buildOpenAPISpec(
  routes: Array<{
    method: string;
    path: string;
    summary: string;
    requestSchema?: z.ZodTypeAny;
    responseSchema?: z.ZodTypeAny;
    tags?: string[];
    requiresAuth?: boolean;
  }>,
): OpenAPISpec {
  const paths: Record<string, unknown> = {};

  for (const route of routes) {
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}');
    if (!paths[pathKey]) paths[pathKey] = {};
    (paths[pathKey] as Record<string, unknown>)[route.method.toLowerCase()] = {
      summary: route.summary,
      tags: route.tags ?? [],
      security: route.requiresAuth ? [{ bearerAuth: [] }] : [],
      responses: {
        '200': { description: 'Success' },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthenticated' },
        '429': { description: 'Rate limit exceeded' },
        '500': { description: 'Internal server error' },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: API_TITLE,
      version: '0.1.0',
      description: API_DESCRIPTION,
    },
    paths,
    components: {
      schemas: {},
    },
  };
}
