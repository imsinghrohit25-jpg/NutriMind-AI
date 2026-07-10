// Real eval runner — executes each case through the REAL specialist agent (agents/index.ts's
// REAL_AGENT_REGISTRY) and then the REAL Output Guard (agents/output-guard.ts), exactly as
// agents/supervisor.ts's dispatch->guard path does for a single-agent turn. No mocked agent
// behavior, no simulated scoring — every checked fact (tool trace, response text, handoff state,
// guard verdict) is the genuine output of the real Phase 13 pipeline.

import { REAL_AGENT_REGISTRY } from '../index.js';
import { ToolRegistry } from '../tool-registry.js';
import { runOutputGuard } from '../output-guard.js';
import type { AgentEvalCase, AgentEvalCaseResult, AgentEvalSuiteResult } from './types.js';

export async function runEvalCase(evalCase: AgentEvalCase): Promise<AgentEvalCaseResult> {
  const failures: string[] = [];
  const runner = REAL_AGENT_REGISTRY[evalCase.agent];
  const ctx = evalCase.buildCtx();
  const registry = evalCase.buildRegistry?.() ?? new ToolRegistry();

  const result = await runner({
    message: evalCase.message,
    ctx,
    registry,
    locale: 'en-IN',
    handoffState: evalCase.handoffState ?? {},
  });

  const guardResult = runOutputGuard({
    responseText: result.responseText,
    toolTrace: result.toolTrace,
    allergenRecheck: result.allergenRecheckInput,
    requiresMedicalDisclaimer: result.requiresMedicalDisclaimer,
    locale: 'en-IN',
  });

  const expectGuardAllowed = evalCase.expect.guardAllowed ?? true;
  if (guardResult.allowed !== expectGuardAllowed) {
    failures.push(
      `expected guardResult.allowed=${expectGuardAllowed}, got ${guardResult.allowed}` +
      (guardResult.rejectionReason ? ` (reason: ${guardResult.rejectionReason})` : ''),
    );
  }

  const responseText = guardResult.allowed ? guardResult.finalText : result.responseText;

  for (const tool of evalCase.expect.toolsCalled ?? []) {
    if (!result.toolTrace.some((t) => t.tool === tool)) {
      failures.push(`expected tool "${tool}" to be called — actual trace: [${result.toolTrace.map((t) => t.tool).join(', ')}]`);
    }
  }

  for (const kw of evalCase.expect.responseIncludes ?? []) {
    if (!responseText.toLowerCase().includes(kw.toLowerCase())) {
      failures.push(`expected response to include "${kw}" — actual: "${responseText}"`);
    }
  }

  for (const kw of evalCase.expect.responseExcludes ?? []) {
    if (responseText.toLowerCase().includes(kw.toLowerCase())) {
      failures.push(`expected response to NOT include "${kw}" — actual: "${responseText}"`);
    }
  }

  for (const [key, expected] of Object.entries(evalCase.expect.handoffStateIncludes ?? {})) {
    const actual = result.handoffState?.[key];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`expected handoffState.${key} = ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  return { id: evalCase.id, agent: evalCase.agent, description: evalCase.description, passed: failures.length === 0, failures };
}

export async function runEvalSuite(cases: AgentEvalCase[]): Promise<AgentEvalSuiteResult> {
  const results: AgentEvalCaseResult[] = [];
  for (const evalCase of cases) {
    results.push(await runEvalCase(evalCase));
  }

  const byAgent: AgentEvalSuiteResult['byAgent'] = {};
  for (const r of results) {
    const bucket = byAgent[r.agent] ?? { total: 0, passed: 0, passRate: 0 };
    bucket.total += 1;
    if (r.passed) bucket.passed += 1;
    byAgent[r.agent] = bucket;
  }
  for (const bucket of Object.values(byAgent)) bucket.passRate = bucket.total > 0 ? bucket.passed / bucket.total : 1;

  const passRate = results.length > 0 ? results.filter((r) => r.passed).length / results.length : 1;
  return { results, passRate, byAgent };
}
