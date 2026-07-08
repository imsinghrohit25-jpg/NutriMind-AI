// Layer 2 aggregation — orchestrator. Phase 11 (§12.2).

import type { StoredMemoryEvent } from '../events.js';
import type { FactCandidate } from './types.js';
import { computeEatingPatternFacts } from './eating-patterns.js';
import { computeUserHabitFacts } from './user-habits.js';
import { computeHealthGoalFacts } from './health-goals.js';
import { computeFamilyPreferenceFacts } from './family-preferences.js';
import { computeRegionalCuisineFacts } from './regional-cuisine.js';
import { computeTravelHistoryFacts } from './travel-history.js';
import { computeSeasonalPatternFacts } from './seasonal-patterns.js';

export * from './types.js';
export { computeEatingPatternFacts } from './eating-patterns.js';
export { computeUserHabitFacts } from './user-habits.js';
export { computeHealthGoalFacts } from './health-goals.js';
export { computeFamilyPreferenceFacts } from './family-preferences.js';
export { computeRegionalCuisineFacts } from './regional-cuisine.js';
export { computeTravelHistoryFacts } from './travel-history.js';
export { computeSeasonalPatternFacts } from './seasonal-patterns.js';

/** Run every fact taxonomy's aggregator over one user's event history. `seasonalItemsThisMonth`
 *  is optional — pass the real seasonal_produce lookup for the user's country/month, or omit to
 *  skip that taxonomy (never fabricate a seasonal list). */
export function aggregateAllFacts(
  events: StoredMemoryEvent[],
  opts: { seasonalItemsThisMonth?: readonly string[]; asOf?: Date } = {},
): FactCandidate[] {
  const asOf = opts.asOf ?? new Date();
  return [
    ...computeEatingPatternFacts(events),
    ...computeUserHabitFacts(events),
    ...computeHealthGoalFacts(events, asOf),
    ...computeFamilyPreferenceFacts(events),
    ...computeRegionalCuisineFacts(events),
    ...computeTravelHistoryFacts(events),
    ...(opts.seasonalItemsThisMonth ? computeSeasonalPatternFacts(events, opts.seasonalItemsThisMonth) : []),
  ];
}
