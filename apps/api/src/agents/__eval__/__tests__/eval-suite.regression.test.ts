// CI regression gate — Phase 13 (§16.5: "evals-as-code in CI with regression thresholds").
// Referenced directly from .github/workflows/ci.yml as a named "GATE: ..." step, same convention
// as the existing engine/allergen/planner/voice/family regression gates. Runs every real fixture
// through the REAL specialist agents + REAL Output Guard (agents/__eval__/runner.ts) — a failure
// here means an actual behavior regression in the multi-agent system, not a flaky LLM judgment
// call (see fixtures/index.ts's comment on why this is safely automatable in this environment).

import { describe, it, expect } from 'vitest';
import { runEvalCase, runEvalSuite } from '../runner.js';
import { ALL_AGENT_EVAL_CASES } from '../fixtures/index.js';

// Tolerant, not all-or-nothing — the addendum explicitly asks for a REGRESSION THRESHOLD, not a
// zero-tolerance gate, since once a real LLM provider key is configured the explain step's output
// (though never its numbers, per the Output Guard) may vary in phrasing across model versions.
const REGRESSION_PASS_THRESHOLD = 0.95;

describe('Multi-agent eval suite — per-case (pinpoints exactly which fixture regressed)', () => {
  for (const evalCase of ALL_AGENT_EVAL_CASES) {
    it(`[${evalCase.agent}] ${evalCase.id} — ${evalCase.description}`, async () => {
      const result = await runEvalCase(evalCase);
      expect(result.failures, result.failures.join('\n')).toEqual([]);
    });
  }
});

describe('Multi-agent eval suite — aggregate regression threshold', () => {
  it(`overall pass rate is >= ${REGRESSION_PASS_THRESHOLD * 100}% across all ${ALL_AGENT_EVAL_CASES.length} fixtures`, async () => {
    const suite = await runEvalSuite(ALL_AGENT_EVAL_CASES);
    const failing = suite.results.filter((r) => !r.passed);
    const report = failing.map((r) => `  [${r.agent}] ${r.id}: ${r.failures.join('; ')}`).join('\n');

    expect(
      suite.passRate,
      `pass rate ${(suite.passRate * 100).toFixed(1)}% below ${REGRESSION_PASS_THRESHOLD * 100}% threshold. Failing cases:\n${report}`,
    ).toBeGreaterThanOrEqual(REGRESSION_PASS_THRESHOLD);
  });

  it('reports a non-zero, real per-agent breakdown for every one of the 9 agents', async () => {
    const suite = await runEvalSuite(ALL_AGENT_EVAL_CASES);
    const agents = Object.keys(suite.byAgent);
    expect(agents).toHaveLength(9);
    for (const agent of agents) {
      expect(suite.byAgent[agent]!.total).toBeGreaterThan(0);
    }
  });
});
