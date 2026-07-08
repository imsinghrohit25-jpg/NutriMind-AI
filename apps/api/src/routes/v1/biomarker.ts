// Biomarker platform routes — Phase 14.
// POST /api/v1/biomarker/lab-reports/upload — upload lab report PDF/image
// GET  /api/v1/biomarker/lab-results        — fetch results with optional filter
// GET  /api/v1/biomarker/lab-results/:type/history — time-series for one biomarker
// GET  /api/v1/biomarker/types              — registry
// POST /api/v1/biomarker/lab-results/manual — manual entry
// GET  /api/v1/biomarker/glucose/readings   — CGM readings
// GET  /api/v1/biomarker/glucose/tir        — time-in-range stats
// POST /api/v1/biomarker/oauth/dexcom/callback — Dexcom OAuth exchange
// DELETE /api/v1/biomarker/oauth/dexcom     — disconnect Dexcom

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../../gateway/router.js';
import { parseAndPersistLabReport } from '../../biomarker/lab-ocr-parser.js';
import { exchangeDexcomCode, computeTimeInRange } from '../../biomarker/dexcom.js';
import { flagLabResults } from '../../biomarker/flag-engine.js';
import type { BiomarkerType } from '../../biomarker/types.js';

type AuthedRequest = FastifyRequest & { userId?: string };

export async function registerBiomarkerRoutes(
  fastify:  FastifyInstance,
  supabase: SupabaseClient,
  gateway:  GatewayRouter,
): Promise<void> {

  // ── Lab report upload (multipart PDF/image → OCR → parse) ────────────────
  fastify.post('/api/v1/biomarker/lab-reports/upload', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as {
      reportDate:  string;
      labName?:    string;
      ocrText?:    string;    // pre-processed OCR text (from mobile on-device OCR)
      filePath?:   string;    // Supabase Storage path for the original file
    };

    if (!body?.reportDate) return reply.code(400).send({ error: 'reportDate required' });
    if (!body?.ocrText)    return reply.code(400).send({ error: 'ocrText required' });

    // Create lab report record
    const { data: report, error: reportErr } = await supabase
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

    // Parse + persist (async — return reportId immediately)
    parseAndPersistLabReport({
      labReportId: report.id as string,
      userId,
      ocrText:     body.ocrText,
      reportDate:  body.reportDate,
      supabase,
      gateway,
    }).catch((err) => {
      console.error('[biomarker] parse error:', err);
    });

    return reply.code(202).send({ reportId: report.id, status: 'processing' });
  });

  // ── Lab report parse status ───────────────────────────────────────────────
  fastify.get('/api/v1/biomarker/lab-reports/:id', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const { id } = req.params as { id: string };

    const { data, error } = await supabase
      .from('lab_reports')
      .select('id, report_date, lab_name, parse_status, parse_error, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return reply.code(404).send({ error: 'Not found' });
    return reply.send(data);
  });

  // ── Lab results ───────────────────────────────────────────────────────────
  fastify.get('/api/v1/biomarker/lab-results', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { biomarkerType, from, to, limit } = req.query as {
      biomarkerType?: string; from?: string; to?: string; limit?: string;
    };

    let query = supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(parseInt(limit ?? '100', 10));

    if (biomarkerType) query = query.eq('biomarker_type', biomarkerType);
    if (from)          query = query.gte('measured_at', from);
    if (to)            query = query.lte('measured_at', to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    // Fetch registry for flagging
    const { data: registry } = await supabase.from('biomarker_types').select('*');
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
  fastify.get('/api/v1/biomarker/lab-results/:type/history', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const { type } = req.params as { type: string };

    const { data, error } = await supabase
      .from('lab_results')
      .select('value, unit, measured_at, source, flags')
      .eq('user_id', userId)
      .eq('biomarker_type', type)
      .order('measured_at', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ biomarkerType: type, history: data });
  });

  // ── Biomarker registry ────────────────────────────────────────────────────
  fastify.get('/api/v1/biomarker/types', async (_req, reply: FastifyReply) => {
    const { data, error } = await supabase.from('biomarker_types').select('*').order('panel').order('display_name');
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ types: data });
  });

  // ── Manual lab result entry ───────────────────────────────────────────────
  fastify.post('/api/v1/biomarker/lab-results/manual', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as {
      biomarkerType: string; value: number; unit: string;
      measuredAt: string; notes?: string;
    };

    if (!body?.biomarkerType || body?.value === undefined || !body?.measuredAt) {
      return reply.code(400).send({ error: 'biomarkerType, value, measuredAt required' });
    }

    const { data, error } = await supabase
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
    return reply.code(201).send({ id: data?.id });
  });

  // ── CGM glucose readings ──────────────────────────────────────────────────
  fastify.get('/api/v1/biomarker/glucose/readings', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };

    let query = supabase
      .from('glucose_readings')
      .select('*')
      .eq('user_id', userId)
      .order('reading_time', { ascending: false })
      .limit(parseInt(limit ?? '288', 10));   // 288 = 24h of 5-min readings

    if (from) query = query.gte('reading_time', from);
    if (to)   query = query.lte('reading_time', to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ readings: data });
  });

  // ── Time-in-range stats ───────────────────────────────────────────────────
  fastify.get('/api/v1/biomarker/glucose/tir', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const toDate   = to   ? new Date(to)   : new Date();

    const stats = await computeTimeInRange(userId, fromDate, toDate, supabase);
    return reply.send(stats);
  });

  // ── Dexcom OAuth callback ─────────────────────────────────────────────────
  fastify.post('/api/v1/biomarker/oauth/dexcom/callback', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { code, redirectUri, codeVerifier } = req.body as {
      code: string; redirectUri: string; codeVerifier: string;
    };

    const tokens = await exchangeDexcomCode(code, redirectUri, codeVerifier);

    await supabase.from('oauth_tokens').upsert({
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
  fastify.delete('/api/v1/biomarker/oauth/dexcom', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    await supabase.from('oauth_tokens').delete().eq('user_id', userId).eq('provider', 'dexcom');
    return reply.send({ disconnected: true, provider: 'dexcom' });
  });
}
