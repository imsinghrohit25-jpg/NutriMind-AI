#!/usr/bin/env node
// Capacity model — Phase 12 (§13.1/§13.5). Spreadsheet-as-code: run this file to regenerate the
// table in capacity-model.md's "Computed" section (`node docs/scale/capacity-model.mjs`) rather
// than hand-typing arithmetic that silently drifts from the assumptions next to it.
//
// All inputs are named assumptions, not magic numbers — change them here, not in the prose.

const ASSUMPTIONS = {
  registeredUsers: 100_000_000,       // addendum §13.1 design ceiling
  dailyActiveFraction: 0.15,          // DAU/registered — typical consumer nutrition-app range
  scansPerDAUPerDay: 3,               // barcode scans, primary daily action
  aiConversationsPerDay: 10_000_000,  // addendum §13.1 design ceiling
  peakToAverageRatio: 4,              // burst factor (meal-time clustering: breakfast/lunch/dinner)
  cacheHitRateBarcode: 0.90,          // addendum §13.1 target — fraction of scans NOT hitting DB
  avgDbConnectionsPerPod: 10,         // matches app.ts's postgres() pool `max: 10`
  targetCpuUtilization: 0.70,         // HPA target (values.yaml's api.autoscaling)
  reqsPerPodPerSecCapacity: 150,      // conservative Fastify + Node single-pod estimate, untested
  costPerPodHourUsd: 0.05,            // rough small-pod (0.5 vCPU/512Mi) cloud estimate
  costPerLlmCallUsd: 0.003,           // blended estimate across T0(free)/T1/T2 mix — see note below
};

function computeCapacity(a) {
  const dau = a.registeredUsers * a.dailyActiveFraction;
  const scansPerDay = dau * a.scansPerDAUPerDay;
  const avgScanQps = scansPerDay / 86400;
  const peakScanQps = avgScanQps * a.peakToAverageRatio;

  const dbHitScanQpsPeak = peakScanQps * (1 - a.cacheHitRateBarcode);
  const podsForScanTraffic = Math.ceil(peakScanQps / a.reqsPerPodPerSecCapacity);
  const dbConnectionsNeeded = podsForScanTraffic * a.avgDbConnectionsPerPod;

  const avgAiQps = a.aiConversationsPerDay / 86400;
  const peakAiQps = avgAiQps * a.peakToAverageRatio;

  const dailyLlmCostUsd = a.aiConversationsPerDay * a.costPerLlmCallUsd;
  const monthlyLlmCostUsd = dailyLlmCostUsd * 30;

  const monthlyPodCostUsd = podsForScanTraffic * 24 * 30 * a.costPerPodHourUsd;

  return {
    dailyActiveUsers: Math.round(dau),
    scansPerDay: Math.round(scansPerDay),
    avgScanQps: round2(avgScanQps),
    peakScanQps: round2(peakScanQps),
    dbHitScanQpsAtPeak: round2(dbHitScanQpsPeak),
    podsForScanTrafficAtPeak: podsForScanTraffic,
    dbConnectionsNeededAtPeak: dbConnectionsNeeded,
    avgAiQps: round2(avgAiQps),
    peakAiQps: round2(peakAiQps),
    estMonthlyLlmCostUsd: Math.round(monthlyLlmCostUsd),
    estMonthlyPodCostUsdForScanTrafficOnly: Math.round(monthlyPodCostUsd),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const result = computeCapacity(ASSUMPTIONS);

if (process.argv[1] && process.argv[1].endsWith('capacity-model.mjs')) {
  console.log(JSON.stringify({ assumptions: ASSUMPTIONS, computed: result }, null, 2));
}

export { ASSUMPTIONS, computeCapacity };
