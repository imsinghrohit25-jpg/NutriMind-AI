// Behavioural signals — extracts dietary patterns from scan history.
// Used by the Copilot to personalise responses (e.g., "you often scan high-sodium snacks").
// Pure function — reads pre-aggregated data, no LLM.

export interface ScanHistoryRow {
  healthScore: number;
  band:        string;
  sodiumMg?:   number | null;
  sugarsG?:    number | null;
  proteinG?:   number | null;
  category?:   string | null;
  scannedAt:   string;
}

export interface BehaviouralSignals {
  avgHealthScore:      number;
  dominantBand:        string;
  topCategories:       string[];     // most-scanned product categories
  frequentHighSodium:  boolean;      // >30% of scans are high-sodium (>300mg/100g)
  frequentHighSugar:   boolean;      // >30% of scans are high-sugar (>15g/100g)
  lowFibrePattern:     boolean;      // avg fibre < 3g in scanned products
  recentTrend:         'improving' | 'declining' | 'stable';
}

export function extractSignals(history: ScanHistoryRow[]): BehaviouralSignals {
  if (history.length === 0) {
    return {
      avgHealthScore:     0,
      dominantBand:       'unknown',
      topCategories:      [],
      frequentHighSodium: false,
      frequentHighSugar:  false,
      lowFibrePattern:    false,
      recentTrend:        'stable',
    };
  }

  const n = history.length;

  const avgHealthScore = Math.round(
    history.reduce((s, r) => s + r.healthScore, 0) / n * 10,
  ) / 10;

  const bandCounts = new Map<string, number>();
  for (const r of history) {
    bandCounts.set(r.band, (bandCounts.get(r.band) ?? 0) + 1);
  }
  const dominantBand = [...bandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

  const catCounts = new Map<string, number>();
  for (const r of history) {
    if (r.category) catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);
  }
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const highSodiumCount = history.filter((r) => (r.sodiumMg ?? 0) > 300).length;
  const highSugarCount  = history.filter((r) => (r.sugarsG  ?? 0) > 15).length;

  const frequentHighSodium = highSodiumCount / n > 0.3;
  const frequentHighSugar  = highSugarCount  / n > 0.3;

  // Trend: compare avg score of first half vs second half
  const midpoint   = Math.floor(n / 2);
  const firstHalf  = history.slice(0, midpoint);
  const secondHalf = history.slice(midpoint);
  const avgFirst   = firstHalf.reduce((s, r) => s + r.healthScore, 0) / (firstHalf.length || 1);
  const avgSecond  = secondHalf.reduce((s, r) => s + r.healthScore, 0) / (secondHalf.length || 1);
  const recentTrend: BehaviouralSignals['recentTrend'] =
    avgSecond - avgFirst > 3 ? 'improving' :
    avgFirst - avgSecond > 3 ? 'declining' : 'stable';

  return {
    avgHealthScore,
    dominantBand,
    topCategories,
    frequentHighSodium,
    frequentHighSugar,
    lowFibrePattern: false,  // requires fibre data in history rows; Phase 11
    recentTrend,
  };
}
