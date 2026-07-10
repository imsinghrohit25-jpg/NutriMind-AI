// ocr.process — Phase 13 (§16.3). One tool, four real document-type branches, each wrapping an
// existing, already-tested parser exactly as it exists — no new OCR/extraction logic here, only
// dispatch by `docType`. Every branch surfaces per-field confidence; none silently accepts a
// low-confidence field into pantry/biomarker/log data (that decision belongs to the caller/UI,
// per §16.4's OCR Agent spec — this tool only reports confidence, it never suppresses data).

import type { ToolDefinition, ToolContext } from '../types.js';
import { parseLabelText, type ParsedLabel } from '../../scan/label-parser/parser.js';
import type { LabelFormatId } from '../../scan/label-parser/label-formats/types.js';
import { parseReceipt, parseAndSavePantryItems, type ParsedReceipt } from '../../pantry/receipt-ocr.js';
import { parseAndPersistLabReport } from '../../biomarker/lab-ocr-parser.js';
import { scanMenuText, type MenuScanResult } from '../../restaurant/menu-scanner.js';

export type OcrProcessInput =
  | { docType: 'label'; rawText: string; formatId?: LabelFormatId }
  | { docType: 'receipt'; rawText: string; persist: boolean }
  | { docType: 'lab_report'; rawText: string; labReportId: string; reportDate: string }
  | { docType: 'menu'; rawText: string };

export type OcrProcessOutput =
  | { docType: 'label'; result: ParsedLabel }
  | { docType: 'receipt'; result: ParsedReceipt; persisted?: { receiptId: string; itemCount: number } }
  | { docType: 'lab_report'; result: { persisted: number; skipped: number } }
  | { docType: 'menu'; result: MenuScanResult };

export const ocrProcessTool: ToolDefinition<OcrProcessInput, OcrProcessOutput> = {
  name: 'ocr.process',
  description: 'Type-specific OCR extraction (label/receipt/lab_report/menu) with per-field confidence. Never silently commits low-confidence fields — that decision belongs to the caller/UI.',
  execute: async (input, ctx) => {
    switch (input.docType) {
      case 'label':
        return { docType: 'label', result: parseLabelText(input.rawText, input.formatId) };

      case 'receipt': {
        if (input.persist) {
          const persisted = await parseAndSavePantryItems({
            userId: ctx.userId,
            text: input.rawText,
            supabase: ctx.supabase,
            gateway: ctx.gateway ?? undefined,
          });
          const result = await parseReceipt({ text: input.rawText, gateway: ctx.gateway ?? undefined });
          return { docType: 'receipt', result, persisted };
        }
        const result = await parseReceipt({ text: input.rawText, gateway: ctx.gateway ?? undefined });
        return { docType: 'receipt', result };
      }

      case 'lab_report': {
        const result = await parseAndPersistLabReport({
          labReportId: input.labReportId,
          userId: ctx.userId,
          ocrText: input.rawText,
          reportDate: input.reportDate,
          supabase: ctx.supabase,
          gateway: ctx.gateway ?? undefined,
        });
        return { docType: 'lab_report', result };
      }

      case 'menu': {
        if (!ctx.gateway) throw new Error('ocr.process(menu) requires the AI gateway to be configured');
        const result = await scanMenuText({ text: input.rawText, gateway: ctx.gateway });
        return { docType: 'menu', result };
      }
    }
  },
};
