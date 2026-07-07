import { z } from 'zod';

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        version: z.string().default('v1'),
        disclaimer_required: z.boolean().optional(),
      })
      .optional(),
  });

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      requestId: z.string(),
      version: z.string().default('v1'),
    })
    .optional(),
});

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: { requestId: string; version: string; disclaimer_required?: boolean };
};

export type ApiError = z.infer<typeof ApiErrorSchema>;

export function ok<T>(
  data: T,
  meta?: { requestId?: string; disclaimer_required?: boolean },
): ApiSuccess<T> {
  return {
    ok: true,
    data,
    meta: { requestId: meta?.requestId ?? '', version: 'v1', ...meta },
  };
}

export function err(
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
): ApiError {
  return {
    ok: false,
    error: { code, message, details },
    meta: { requestId: requestId ?? '', version: 'v1' },
  };
}
