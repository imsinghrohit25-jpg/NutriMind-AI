// Biomarker platform routes — Phase 14.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are
// `/v1/biomarker/*` (this file previously hardcoded `/api/v1/biomarker/*`, which never
// resolved to anything real; read a non-existent `req.userId`, so every handler always 401'd;
// and took a 3-arg `(fastify, supabase, gateway)` signature Fastify's `.register()` cannot
// supply — `supabase` would have received the register options object instead of a real
// client. See ADR-0022.)
// POST /v1/biomarker/lab-reports/upload — upload lab report PDF/image
// GET  /v1/biomarker/lab-results        — fetch results with optional filter
// GET  /v1/biomarker/lab-results/:type/history — time-series for one biomarker
// GET  /v1/biomarker/types              — registry
// POST /v1/biomarker/lab-results/manual — manual entry
// GET  /v1/biomarker/glucose/readings   — CGM readings
// GET  /v1/biomarker/glucose/tir        — time-in-range stats
// POST /v1/biomarker/oauth/dexcom/callback — Dexcom OAuth exchange
// DELETE /v1/biomarker/oauth/dexcom     — disconnect Dexcom

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { parseAndPersistLabReport } from '../../biomarker/lab-ocr-parser.js';
import { exchangeDexcomCode, computeTimeInRange } from '../../biomarker/dexcom.js';
import { flagLabResults } from '../../biomarker/flag-engine.js';
import type { BiomarkerType } from '../../biomarker/types.js';
import { recordEventBestEffort } from '../../memory/events.js';

export default async function biomarkerRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Lab report upload (multipart PDF/image → OCR → parse) ────────────────
  fastify.post('/biomarker/lab-reports/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const body = req.body as {
      reportDate:  string;
      labName?:    string;
      ocrText?:    string;    // pre-processed OCR text (from mobile on-device OCR)
      filePath?:   string;    // Supabase Storage path for the original file
    };

    if (!body?.reportDate) return reply.code(400).send({ error: 'reportDate required' });
    if (!body?.ocrText)    return reply.code(400).send({ error: 'ocrText required' });

    // Create lab report record
    const { data: report, error: reportErr } = await fastify.supabase
      .from('lab_reports')
      .insert({
        user_id:      userId,
        report_date:  body.reportDate,
        lab_name:     body.labName ?? null,
        file_path:    body.filePath ?? null,
        ocr_raw:      body.ocrText,
        parse_status: 'processing',
      })
      .select('id')
      .single();

    if (reportErr || !report) {
      return reply.code(500).send({ error: reportErr?.message ?? 'Insert failed' });
    }

    // Parse + persist (async — return reportId immediately). gateway is optional here —
    // parseAndPersistLabReport falls back to regex-only extraction when absent.
    parseAndPersistLabReport({
      labReportId: report.id as string,
      userId,
      ocrText:     body.ocrText,
      reportDate:  body.reportDate,
      supabase:    fastify.supabase,
      gateway:     fastify.gateway ?? undefined,
    }).catch((err) => {
      console.error('[biomarker] parse error:', err);
    });

    return reply.code(202).send({ reportId: report.id, status: 'processing' });
  });

  // ── Lab report parse status ───────────────────────────────────────────────
  fastify.get('/biomarker/lab-reports/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;
    const { id } = req.params as { id: string };

    const { data, error } = await fastify.supabase
      .from('lab_reports')
      .select('id, report_date, lab_name, parse_status, parse_error, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return reply.code(404).send({ error: 'Not found' });
    return reply.send(data);
  });

  // ── Lab results ───────────────────────────────────────────────────────────
  fastify.get('/biomarker/lab-results', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const { biomarkerType, from, to, limit } = req.query as {
      biomarkerType?: string; from?: string; to?: string; limit?: string;
    };

    const parsedLimit = parseInt(limit ?? '100', 10);
    let query = fastify.supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(Number.isFinite(parsedLimit) ? parsedLimit : 100);

    if (biomarkerType) query = query.eq('biomarker_type', biomarkerType);
    if (from)          query = query.gte('measured_at', from);
    if (to)            query = query.lte('measured_at', to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    // Fetch registry for flagging
    const { data: registry } = await fastify.supabase.from('biomarker_types').select('*');
    const biomarkerTypes: BiomarkerType[] = (registry ?? []).map((r) => ({
      id:          r.id as string,
      displayName: r.display_name as string,
      unit:        r.unit as string,
      normalMin:   r.normal_min as number | undefined,
      normalMax:   r.normal_max as number | undefined,
      panel:       r.panel as BiomarkerType['panel'],
    }));

    const flags = flagLabResults(
      (data ?? []).map((r) => ({ biomarkerType: r.biomarker_type as string, value: r.value as number })),
      biomarkerTypes,
    );

    return reply.send({ results: data, flags });
  });

  // ── Time-series for a single biomarker ───────────────────────────────────
  fastify.get('/biomarker/lab-results/:type/history', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;
    const { type } = req.params as { type: string };

    const { data, error } = await fastify.supabase
      .from('lab_results')
      .select('value, unit, measured_at, source, flags')
      .eq('user_id', userId)
      .eq('biomarker_type', type)
      .order('measured_at', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ biomarkerType: type, history: data });
  });

  // ── Biomarker registry ────────────────────────────────────────────────────
  fastify.get('/biomarker/types', async (_req, reply: FastifyReply) => {
    const { data, error } = await fastify.supabase.from('biomarker_types').select('*').order('panel').order('display_name');
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ types: data });
  });

  // ── Manual lab result entry ───────────────────────────────────────────────
  fastify.post('/biomarker/lab-results/manual', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const body = req.body as {
      biomarkerType: string; value: number; unit: string;
      measuredAt: string; notes?: string;
    };

    if (!body?.biomarkerType || body?.value === undefined || !body?.measuredAt) {
      return reply.code(400).send({ error: 'biomarkerType, value, measuredAt required' });
    }

    const { data, error } = await fastify.supabase
      .from('lab_results')
      .insert({
        user_id:        userId,
        biomarker_type: body.biomarkerType,
        value:          body.value,
        unit:           body.unit,
        measured_at:    body.measuredAt,
        source:         'manual',
        flags:          [],
        notes:          body.notes ?? null,
      })
      .select('id')
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    // Phase 11 (AI Memory System, Layer 1) — best-effort, never blocks the response.
    recordEventBestEffort(fastify.supabase, userId, 'biomarker_reading', {
      biomarkerType: body.biomarkerType,
      value: body.value,
      unit: body.unit,
    });

    return reply.code(201).send({ id: data?.id });
  });

  // ── CGM glucose readings ──────────────────────────────────────────────────
  fastify.get('/biomarker/glucose/readings', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };

    const parsedLimit = parseInt(limit ?? '288', 10); // 288 = 24h of 5-min readings
    let query = fastify.supabase
      .from('glucose_readings')
      .select('*')
      .eq('user_id', userId)
      .order('reading_time', { ascending: false })
      .limit(Number.isFinite(parsedLimit) ? parsedLimit : 288);

    if (from) query = query.gte('reading_time', from);
    if (to)   query = query.lte('reading_time', to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ readings: data });
  });

  // ── Time-in-range stats ───────────────────────────────────────────────────
  fastify.get('/biomarker/glucose/tir', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const toDate   = to   ? new Date(to)   : new Date();

    const stats = await computeTimeInRange(userId, fromDate, toDate, fastify.supabase);
    return reply.send(stats);
  });

  // ── Dexcom OAuth callback ─────────────────────────────────────────────────
  fastify.post('/biomarker/oauth/dexcom/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const body = req.body as { code?: string; redirectUri?: string; codeVerifier?: string };
    if (!body?.code || !body?.redirectUri || !body?.codeVerifier) {
      return reply.code(400).send({ error: 'code, redirectUri, codeVerifier required' });
    }

    const tokens = await exchangeDexcomCode(body.code, body.redirectUri, body.codeVerifier);

    await fastify.supabase.from('oauth_tokens').upsert({
      user_id:       userId,
      provider:      'dexcom',
      access_token:  tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at:    tokens.expiresAt.toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    return reply.send({ connected: true, provider: 'dexcom' });
  });

  // ── Disconnect Dexcom ─────────────────────────────────────────────────────
  fastify.delete('/biomarker/oauth/dexcom', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    await fastify.supabase.from('oauth_tokens').delete().eq('user_id', req.user.id).eq('provider', 'dexcom');
    return reply.send({ disconnected: true, provider: 'dexcom' });
  });
}
