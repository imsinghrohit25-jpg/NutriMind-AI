// biomarker.trends — Phase 13 (§16.3). "Statistical trends (slope, reference ranges) — computed,
// not LLM-guessed." Wraps engines/biomarker/flag-engine.ts's flagLabResults() for reference-range
// flagging plus stats/linear-regression.ts's computeOlsRegression() (the same real OLS math
// memory/aggregation/health-goals.ts's plateau detection uses — extracted this phase to avoid a
// second, subtly-different implementation) for the trend slope. Never invents a medical
// threshold: normalMin/normalMax come from the real `biomarker_types` DB table, same source
// routes/v1/biomarker.ts already reads for its own flagging.

import type { ToolDefinition, ToolContext } from '../types.js';
import { flagLabResults } from '../../biomarker/flag-engine.js';
import type { BiomarkerType, BiomarkerFlag } from '../../biomarker/types.js';
import { computeOlsRegression } from '../../stats/linear-regression.js';

export interface BiomarkerTrendsInput {
  biomarkerType: string;
  lookbackDays?: number;
}

export interface BiomarkerTrendPoint {
  measuredAt: string;
  value: number;
  unit: string;
}

export interface BiomarkerTrendsOutput {
  biomarkerType: string;
  points: BiomarkerTrendPoint[];
  /** Real OLS slope in [unit]/week — null when fewer than 4 readings exist (not a fabricated
   *  trend from too little data, matching the same 4-reading floor as the plateau memory fact). */
  trend: { slopePerWeek: number; sampleSize: number } | null;
  flags: BiomarkerFlag[];
}

export const biomarkerTrendsTool: ToolDefinition<BiomarkerTrendsInput, BiomarkerTrendsOutput> = {
  name: 'biomarker.trends',
  description: 'Real statistical trend (OLS slope) and reference-range flags for a biomarker over time. Never an LLM-estimated trend or threshold.',
  execute: async (input, ctx) => {
    const lookbackDays = input.lookbackDays ?? 180;
    const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();

    const [resultsResp, registryResp] = await Promise.all([
      ctx.supabase
        .from('lab_results')
        .select('value, unit, measured_at')
        .eq('user_id', ctx.userId)
        .eq('biomarker_type', input.biomarkerType)
        .gte('measured_at', since)
        .order('measured_at', { ascending: true }),
      ctx.supabase.from('biomarker_types').select('*'),
    ]);

    if (resultsResp.error) throw new Error(`biomarker.trends: ${resultsResp.error.message}`);

    const rows = (resultsResp.data ?? []) as Array<{ value: number; unit: string; measured_at: string }>;
    const points: BiomarkerTrendPoint[] = rows.map((r) => ({
      measuredAt: r.measured_at, value: r.value, unit: r.unit,
    }));

    let trend: BiomarkerTrendsOutput['trend'] = null;
    if (points.length >= 4) {
      const t0 = new Date(points[0]!.measuredAt).getTime();
      const { slope, sampleSize } = computeOlsRegression(
        points.map((p) => ({ x: (new Date(p.measuredAt).getTime() - t0) / 86_400_000, y: p.value })),
      );
      trend = { slopePerWeek: Math.round(slope * 7 * 1000) / 1000, sampleSize };
    }

    const registry = ((registryResp.data ?? []) as Array<Record<string, unknown>>).map((r): BiomarkerType => ({
      id: r.id as string,
      displayName: r.display_name as string,
      unit: r.unit as string,
      normalMin: r.normal_min as number | undefined,
      normalMax: r.normal_max as number | undefined,
    }));
    const flags = flagLabResults(
      rows.map((r) => ({ biomarkerType: input.biomarkerType, value: r.value })),
      registry,
    );

    return { biomarkerType: input.biomarkerType, points, trend, flags };
  },
};
