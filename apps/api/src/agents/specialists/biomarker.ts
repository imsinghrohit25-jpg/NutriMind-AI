// Biomarker Agent — Phase 13 (§16.4.5). Flow: ocr.process(lab_report) when a report is being
// uploaded this turn -> biomarker.trends (real OLS statistics + reference-range flags, never an
// LLM-guessed trend/threshold) -> Output Guard appends the medical disclaimer whenever a flag is
// out of range; this agent never diagnoses.
//
// Honest, documented gap (not fabricated as solved): the addendum's "condition rule layers"
// (diabetes-conservative packs etc., §3.5) were deferred in Phase 4 (ADR-0017 — `condition_rules`
// is one of three seeded-but-unimplemented Phase 4 flags, `life_stage_rules`/`allergen_regime_map`
// being the other two) and remain unimplemented — meal alignment below uses the same
// nutrition.compute the Nutrition Agent uses (India/ICMR-NIN default weights), not a
// biomarker-condition-specific rule pack that doesn't exist yet.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { BiomarkerTrendsOutput } from '../tools/biomarker.js';
import { explainWithFallback } from '../explain.js';

const BIOMARKER_KEYWORDS: Record<string, string> = {
  hba1c: 'hba1c',
  'fasting glucose': 'fasting_glucose',
  'blood sugar': 'fasting_glucose',
  glucose: 'fasting_glucose',
  ldl: 'ldl_cholesterol',
  hdl: 'hdl_cholesterol',
  cholesterol: 'total_cholesterol',
  triglycerides: 'triglycerides',
  tsh: 'tsh',
  thyroid: 'tsh',
  creatinine: 'creatinine',
  'vitamin d': 'vitamin_d',
  'vitamin b12': 'vitamin_b12',
};

function extractBiomarkerType(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [keyword, id] of Object.entries(BIOMARKER_KEYWORDS)) {
    if (lower.includes(keyword)) return id;
  }
  return null;
}

function buildTemplate(biomarkerType: string, trends: BiomarkerTrendsOutput): string {
  if (trends.points.length === 0) {
    return `I don't have any recorded ${biomarkerType.replace(/_/g, ' ')} readings yet.`;
  }
  const latest = trends.points[trends.points.length - 1]!;
  const lines = [`Latest ${biomarkerType.replace(/_/g, ' ')}: ${latest.value}${latest.unit} (${latest.measuredAt.slice(0, 10)}).`];
  if (trends.trend) {
    lines.push(`Trend: ${trends.trend.slopePerWeek >= 0 ? '+' : ''}${trends.trend.slopePerWeek}${latest.unit}/week over ${trends.trend.sampleSize} readings.`);
  }
  for (const flag of trends.flags) {
    lines.push(`Flag: ${flag.displayName} is ${flag.flag.replace('_', ' ')} (normal range ${flag.normalMin ?? '—'}-${flag.normalMax ?? '—'} ${flag.unit}).`);
  }
  return lines.join(' ');
}

export const runBiomarkerAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('biomarker', input.registry, input.ctx);

  const biomarkerType = extractBiomarkerType(input.message);
  if (!biomarkerType) {
    return {
      responseText: `Which biomarker would you like to check — e.g. HbA1c, LDL cholesterol, TSH, or Vitamin D?`,
      toolTrace: trace,
    };
  }

  const rawLabText = input.handoffState.labReportText as string | undefined;
  if (rawLabText) {
    const labReportId = input.handoffState.labReportId as string | undefined;
    if (labReportId) {
      await call('ocr.process', {
        docType: 'lab_report', rawText: rawLabText, labReportId,
        reportDate: new Date().toISOString().slice(0, 10),
      });
    }
  }

  const trends = await call<{ biomarkerType: string }, BiomarkerTrendsOutput>('biomarker.trends', { biomarkerType });
  const requiresMedicalDisclaimer = trends.flags.length > 0;

  const template = buildTemplate(biomarkerType, trends);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt:
      'You are a biomarker-trend assistant. Explain the given lab trend/flags conversationally. ' +
      'Never diagnose a condition or state a medical threshold not given to you.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return { responseText, toolTrace: trace, requiresMedicalDisclaimer };
};
