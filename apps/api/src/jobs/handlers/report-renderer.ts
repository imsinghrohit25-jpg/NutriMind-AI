// Report renderer — pure function.
// Turns weekly nutrition data into human-readable notification text + structured report.

import type { DailyNutritionTotal } from '../../engines/meals/aggregate.js';
import type { DailyGapReport, NutrientGap } from '../../engines/meals/gap-analysis.js';

export interface RenderedReport {
  notificationTitle: string;
  notificationBody:  string;
  headline:          string;
  topWins:           string[];    // nutrients on track or under limit
  topConcerns:       string[];    // nutrients over limit
  fibreSummary:      string;
  sodiumSummary:     string;
}

export function renderWeeklyReport(
  weekStart: string,
  memberName: string,
  avg: DailyNutritionTotal,
  gapReport: DailyGapReport,
): RenderedReport {
  const overGaps  = gapReport.gaps.filter((g) => g.status === 'over');
  const underGaps = gapReport.gaps.filter(
    (g) => g.status === 'under' && g.nutrient === 'Dietary fibre',
  );

  const topConcerns = overGaps.slice(0, 3).map(formatConcern);
  const topWins     = gapReport.gaps
    .filter((g) => g.status === 'on_track')
    .slice(0, 3)
    .map((g) => `${g.nutrient} on track (${g.pctOfBudget}% of daily budget)`);

  const headline =
    overGaps.length === 0
      ? `Great week, ${memberName}! Your nutrition was on track.`
      : `${memberName}, here's your weekly nutrition summary.`;

  const notificationBody =
    overGaps.length > 0
      ? `${overGaps[0]!.nutrient} was over limit (${overGaps[0]!.pctOfBudget}% of daily budget avg).`
      : underGaps.length > 0
      ? `Fibre intake was low this week. Try adding more dal, vegetables, or whole grains.`
      : 'Your nutrition was balanced this week. Keep it up!';

  const fibreGap = gapReport.gaps.find((g) => g.nutrient === 'Dietary fibre');
  const sodiumGap = gapReport.gaps.find((g) => g.nutrient === 'Sodium');

  return {
    notificationTitle: `Your weekly nutrition report — ${weekStart}`,
    notificationBody,
    headline,
    topWins,
    topConcerns,
    fibreSummary:  fibreGap
      ? `Avg ${avg.dietaryFiberG}g/day (target: ${fibreGap.budget}g, ${fibreGap.pctOfBudget}%)`
      : `Avg ${avg.dietaryFiberG}g/day`,
    sodiumSummary: sodiumGap
      ? `Avg ${avg.sodiumMg}mg/day (limit: ${sodiumGap.budget}mg, ${sodiumGap.pctOfBudget}%)`
      : `Avg ${avg.sodiumMg}mg/day`,
  };
}

function formatConcern(gap: NutrientGap): string {
  return `${gap.nutrient}: avg ${gap.consumed.toFixed(1)}${gap.unit}/day — ${gap.pctOfBudget}% of daily limit`;
}
