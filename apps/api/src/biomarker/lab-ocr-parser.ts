// Lab report OCR parser — extracts biomarker values from raw OCR text.
// Indian lab format support: SRL Diagnostics, Metropolis, Dr Lal PathLabs, Thyrocare.
// Uses LLM (claude-sonnet-4-6) for structured extraction; falls back to regex for
// common patterns when LLM is unavailable.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';
import type { LabResult, LabResultFlag } from './types.js';

interface ExtractedResult {
  biomarkerType: string;
  value:         number;
  unit:          string;
  flags:         LabResultFlag[];
  confidence:    number;   // 0–1
}

// Regex patterns for common Indian lab report formats
// Format: "Biomarker Name     Value   Unit   Reference Range   Status"
const LAB_LINE_REGEX = /^(.+?)\s{2,}([\d.]+)\s+([\w/%μgn]+)\s/i;

// Maps common lab report name variants to canonical biomarker type IDs
const NAME_ALIASES: Record<string, string> = {
  'fasting blood glucose':    'fasting_glucose',
  'fasting glucose':          'fasting_glucose',
  'blood glucose fasting':    'fasting_glucose',
  'pp glucose':               'postprandial_glucose',
  'post prandial glucose':    'postprandial_glucose',
  'hba1c':                    'hba1c',
  'glycated haemoglobin':     'hba1c',
  'total cholesterol':        'total_cholesterol',
  'ldl cholesterol':          'ldl_cholesterol',
  'ldl-c':                    'ldl_cholesterol',
  'hdl cholesterol':          'hdl_cholesterol',
  'hdl-c':                    'hdl_cholesterol',
  'triglycerides':            'triglycerides',
  'serum tsh':                'tsh',
  'tsh (ultrasensitive)':     'tsh',
  'free t3':                  'free_t3',
  'free t4':                  'free_t4',
  'creatinine':               'creatinine',
  'serum creatinine':         'creatinine',
  'blood urea':               'urea',
  'uric acid':                'uric_acid',
  'serum uric acid':          'uric_acid',
  'egfr':                     'egfr',
  'haemoglobin':              'hemoglobin',
  'hemoglobin':               'hemoglobin',
  'hb':                       'hemoglobin',
  'wbc count':                'wbc',
  'total wbc':                'wbc',
  'leucocyte count':          'wbc',
  '25-oh vitamin d':          'vitamin_d',
  'vitamin d3':               'vitamin_d',
  '25(oh)d':                  'vitamin_d',
  'vitamin b12':              'vitamin_b12',
  'cobalamin':                'vitamin_b12',
  'ferritin':                 'ferritin',
  'serum ferritin':           'ferritin',
  'serum iron':               'iron',
  'alt':                      'alt',
  'sgpt':                     'alt',
  'ast':                      'ast',
  'sgot':                     'ast',
  'alkaline phosphatase':     'alkaline_phosphatase',
  'alp':                      'alkaline_phosphatase',
  'crp':                      'crp',
  'c-reactive protein':       'crp',
  'hs-crp':                   'crp',
  'esr':                      'esr',
  'erythrocyte sedimentation rate': 'esr',
};

function normaliseBiomarkerName(raw: string): string | undefined {
  const lower = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  return NAME_ALIASES[lower];
}

function extractFlags(line: string): LabResultFlag[] {
  const upper = line.toUpperCase();
  const flags: LabResultFlag[] = [];
  if (/\bHIGH\b|\bH\b|\bABOVE NORMAL\b/.test(upper))         flags.push('high');
  if (/\bLOW\b|\bL\b|\bBELOW NORMAL\b/.test(upper))          flags.push('low');
  if (/\bCRITICAL\s*H/.test(upper))                           flags.push('critical_high');
  if (/\bCRITICAL\s*L/.test(upper))                           flags.push('critical_low');
  if (/\bABNORMAL\b|\bOUT OF RANGE\b/.test(upper))            flags.push('abnormal');
  return flags;
}

/** Regex-based fast extraction for common formats. */
function extractWithRegex(ocrText: string): ExtractedResult[] {
  const results: ExtractedResult[] = [];
  const lines = ocrText.split('\n');

  for (const line of lines) {
    const match = LAB_LINE_REGEX.exec(line);
    if (!match) continue;
    const [, namePart, valueStr, unit] = match;
    const biomarkerType = normaliseBiomarkerName(namePart ?? '');
    if (!biomarkerType) continue;
    const value = parseFloat(valueStr ?? '');
    if (isNaN(value)) continue;

    results.push({
      biomarkerType,
      value,
      unit: unit ?? '',
      flags: extractFlags(line),
      confidence: 0.75,
    });
  }

  return results;
}

/** LLM-assisted extraction for complex/ambiguous lab formats. */
async function extractWithLLM(
  ocrText:  string,
  gateway:  GatewayRouter,
  locale:   'en' | 'hi' = 'en',
): Promise<ExtractedResult[]> {
  const SYSTEM = `You are a medical lab report parser. Extract biomarker values from the text.
Return ONLY valid JSON array. Each object must have:
  { "biomarkerType": "<canonical_id>", "value": <number>, "unit": "<string>", "flags": [] }

Canonical biomarker IDs: fasting_glucose, postprandial_glucose, hba1c, total_cholesterol,
ldl_cholesterol, hdl_cholesterol, triglycerides, tsh, free_t3, free_t4, creatinine, urea,
uric_acid, egfr, hemoglobin, wbc, vitamin_d, vitamin_b12, ferritin, iron, alt, ast,
alkaline_phosphatase, crp, esr.

If a biomarker is not in this list, omit it. If value is not numeric, omit it.
flags array: include "high", "low", "critical_high", "critical_low", or "abnormal" if explicitly flagged in report.`;

  const response = await gateway.complete({
    tier:         'parse_assist',
    systemPrompt: SYSTEM,
    messages:     [{ role: 'user', content: `LAB REPORT:\n${ocrText.slice(0, 4000)}` }],
    maxTokens:    1500,
    traceId:      'lab-ocr',
  });

  try {
    const text = response.content;
    // Extract JSON array from response (may be wrapped in markdown)
    const jsonMatch = /\[[\s\S]*\]/.exec(text);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      biomarkerType: string;
      value: number;
      unit: string;
      flags: LabResultFlag[];
    }>;
    return parsed.map((p) => ({ ...p, confidence: 0.9 }));
  } catch {
    return [];
  }
}

/**
 * Main entry point: parse OCR text, extract lab results, persist to Supabase.
 * Tries LLM first, falls back to regex if LLM returns nothing.
 */
export async function parseAndPersistLabReport(opts: {
  labReportId:  string;
  userId:       string;
  ocrText:      string;
  reportDate:   string;
  supabase:     SupabaseClient;
  gateway?:     GatewayRouter;
}): Promise<{ persisted: number; skipped: number }> {
  const { labReportId, userId, ocrText, reportDate, supabase, gateway } = opts;

  let extracted: ExtractedResult[] = [];

  // LLM extraction (preferred)
  if (gateway) {
    try {
      extracted = await extractWithLLM(ocrText, gateway);
    } catch (_) { /* fall through to regex */ }
  }

  // Fallback to regex
  if (extracted.length === 0) {
    extracted = extractWithRegex(ocrText);
  }

  if (extracted.length === 0) {
    await supabase.from('lab_reports').update({
      parse_status: 'failed',
      parse_error:  'No biomarker values found in OCR text',
      updated_at:   new Date().toISOString(),
    }).eq('id', labReportId);
    return { persisted: 0, skipped: 0 };
  }

  // Only accept high-confidence results
  const confident = extracted.filter((e) => e.confidence >= 0.7);

  const rows: LabResult[] = confident.map((e) => ({
    userId,
    labReportId,
    biomarkerType: e.biomarkerType,
    value:         e.value,
    unit:          e.unit,
    measuredAt:    new Date(reportDate + 'T00:00:00Z'),
    source:        'lab_upload',
    flags:         e.flags,
  }));

  const { data, error } = await supabase
    .from('lab_results')
    .upsert(
      rows.map((r) => ({
        user_id:        r.userId,
        lab_report_id:  r.labReportId,
        biomarker_type: r.biomarkerType,
        value:          r.value,
        unit:           r.unit,
        measured_at:    r.measuredAt.toISOString(),
        source:         r.source,
        flags:          r.flags ?? [],
      })),
      { onConflict: 'user_id,biomarker_type,measured_at,source', ignoreDuplicates: true },
    )
    .select('id');

  if (error) {
    await supabase.from('lab_reports').update({
      parse_status: 'failed',
      parse_error:  error.message,
      updated_at:   new Date().toISOString(),
    }).eq('id', labReportId);
    throw new Error(`persistLabResults: ${error.message}`);
  }

  await supabase.from('lab_reports').update({
    parse_status: 'done',
    updated_at:   new Date().toISOString(),
  }).eq('id', labReportId);

  return { persisted: data?.length ?? 0, skipped: rows.length - (data?.length ?? 0) };
}
