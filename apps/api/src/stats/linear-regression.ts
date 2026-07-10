// Ordinary-least-squares linear regression — pure function, no side effects, no LLM.
// Extracted from memory/aggregation/health-goals.ts's computePlateauFact (Phase 11), which had
// this exact math inlined — shared here so Phase 13's biomarker.trends tool computes trends with
// the SAME real statistics, not a second, subtly-different reimplementation.

export interface OlsPoint {
  x: number;
  y: number;
}

export interface OlsResult {
  slope: number;      // y-units per x-unit
  intercept: number;
  sampleSize: number;
}

/** Standard OLS slope/intercept. Returns slope 0 when all x values are identical (no variance
 *  to regress against) rather than dividing by zero. */
export function computeOlsRegression(points: OlsPoint[]): OlsResult {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, sampleSize: 0 };

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  return { slope, intercept, sampleSize: n };
}
