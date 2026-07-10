// OCR Agent — Phase 13 (§16.4.9). Pipeline agent: document-type classification (deterministic
// keyword heuristic — no dedicated classifier tool exists, and this codebase's "derived, never
// divined" discipline means a real keyword rule set beats an invented ML classifier that doesn't
// exist) -> ocr.process with the classified type -> field-level validation (units sane, totals
// reconcile, confidence per field) -> low-confidence fields are surfaced, NEVER silently
// auto-committed into pantry/biomarker/log data (that commit decision belongs to the caller/UI).

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { OcrProcessOutput } from '../tools/ocr.js';
import { explainWithFallback } from '../explain.js';

type DocType = 'label' | 'receipt' | 'lab_report' | 'menu';

const LAB_KEYWORDS = /\b(hba1c|glucose|cholesterol|hemoglobin|creatinine|tsh|mg\/dl|mmol\/l|reference range)\b/i;
const RECEIPT_KEYWORDS = /\b(total|subtotal|qty|invoice|bill no|gstin|₹|rs\.?\s?\d)\b/i;
const MENU_KEYWORDS = /\b(starter|main course|appetizer|biryani|combo|price|menu)\b/i;
const LABEL_KEYWORDS = /\b(nutrition facts|per 100\s?g|energy|protein|carbohydrate|ingredients:)\b/i;

function classifyDocType(rawText: string): DocType {
  if (LAB_KEYWORDS.test(rawText)) return 'lab_report';
  if (LABEL_KEYWORDS.test(rawText)) return 'label';
  if (RECEIPT_KEYWORDS.test(rawText)) return 'receipt';
  if (MENU_KEYWORDS.test(rawText)) return 'menu';
  return 'label'; // most common single-item scan; still real, not a guess at content
}

interface FieldValidation {
  lowConfidenceFields: string[];
  reconciliationWarnings: string[];
}

function validateFields(result: OcrProcessOutput): FieldValidation {
  const lowConfidenceFields: string[] = [];
  const reconciliationWarnings: string[] = [];

  if (result.docType === 'label') {
    lowConfidenceFields.push(...result.result.lowConfidenceFields);
  }

  if (result.docType === 'receipt') {
    const { items, totalRs } = result.result;
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) lowConfidenceFields.push(`${item.name}.quantity`);
    }
    if (totalRs != null) {
      // The sum below decides WHETHER to warn (a threshold check, not a claim) — it is never
      // quoted in the user-facing text. §16.1.1 forbids an agent asserting a number it computed
      // itself; only `totalRs` (the OCR tool's own real parsed value) is safe to quote, so the
      // warning states the discrepancy qualitatively instead of citing the agent's own arithmetic.
      const sum = items.reduce((s, i) => s + (i.priceRs ?? 0), 0);
      if (Math.abs(sum - totalRs) > totalRs * 0.1 && sum > 0) {
        reconciliationWarnings.push(`Item prices don't add up to the receipt total of ₹${totalRs} — some prices may be misread.`);
      }
    }
  }

  if (result.docType === 'menu' && result.result.confidence < 0.6) {
    lowConfidenceFields.push('menu.overall');
  }

  return { lowConfidenceFields, reconciliationWarnings };
}

function buildTemplate(docType: DocType, result: OcrProcessOutput, validation: FieldValidation): string {
  const lines = [`Detected document type: ${docType}.`];

  if (result.docType === 'label') {
    lines.push(`Overall confidence: ${(result.result.overallConfidence * 100).toFixed(0)}%.`);
  } else if (result.docType === 'receipt') {
    lines.push(`Found ${result.result.items.length} item(s)${result.persisted ? `, saved ${result.persisted.itemCount} to your pantry` : ''}.`);
  } else if (result.docType === 'lab_report') {
    lines.push(`Persisted ${result.result.persisted} lab result(s), skipped ${result.result.skipped}.`);
  } else if (result.docType === 'menu') {
    lines.push(`Found ${result.result.items.length} menu item(s), confidence ${(result.result.confidence * 100).toFixed(0)}%.`);
  }

  if (validation.lowConfidenceFields.length > 0) {
    lines.push(`Please confirm these low-confidence fields before I use them: ${validation.lowConfidenceFields.join(', ')}.`);
  }
  lines.push(...validation.reconciliationWarnings);

  return lines.join(' ');
}

export const runOcrAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('ocr', input.registry, input.ctx);

  const rawText = (input.handoffState.ocrRawText as string | undefined) ?? input.message;
  const explicitDocType = input.handoffState.docType as DocType | undefined;
  const docType = explicitDocType ?? classifyDocType(rawText);

  let result: OcrProcessOutput;
  if (docType === 'lab_report') {
    const labReportId = input.handoffState.labReportId as string | undefined;
    if (!labReportId) {
      return { responseText: `I need a lab report record to attach these results to — please upload via the lab report screen first.`, toolTrace: trace };
    }
    result = await call<{ docType: 'lab_report'; rawText: string; labReportId: string; reportDate: string }, OcrProcessOutput>('ocr.process', {
      docType: 'lab_report', rawText, labReportId, reportDate: new Date().toISOString().slice(0, 10),
    });
  } else if (docType === 'receipt') {
    result = await call<{ docType: 'receipt'; rawText: string; persist: boolean }, OcrProcessOutput>('ocr.process', {
      docType: 'receipt', rawText, persist: true,
    });
  } else if (docType === 'menu') {
    if (!input.ctx.gateway) {
      return { responseText: `Reading a menu needs the AI gateway, which isn't configured in this environment.`, toolTrace: trace };
    }
    result = await call<{ docType: 'menu'; rawText: string }, OcrProcessOutput>('ocr.process', { docType: 'menu', rawText });
  } else {
    result = await call<{ docType: 'label'; rawText: string }, OcrProcessOutput>('ocr.process', { docType: 'label', rawText });
  }

  const validation = validateFields(result);
  const template = buildTemplate(docType, result, validation);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a document-scanning assistant. Explain what was extracted and which fields need the user\'s confirmation, conversationally. Never invent a value for a low-confidence field.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return {
    responseText,
    toolTrace: trace,
    handoffState: { lastOcrDocType: docType, lastOcrLowConfidenceFields: validation.lowConfidenceFields },
  };
};
