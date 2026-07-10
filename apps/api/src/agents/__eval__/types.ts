// Agent eval framework — Phase 13 (§16.5: "evals-as-code in CI with regression thresholds").
// Unlike copilot/__eval__/eval-cases.ts (fixtures only, explicitly "run manually... not automated
// in CI due to LLM variability"), these ARE automated: every specialist agent's tool-calling
// pipeline is deterministic by design (§16.1.1, "agents orchestrate and explain, engines
// compute") and this environment has no LLM provider key, so `explainWithFallback` always takes
// the deterministic template path — meaning both the tool trace AND the response text are
// reproducible, and a real pass/fail score can run in CI without LLM-judge variability.

import type { AgentName, ToolContext, ToolName } from '../types.js';
import type { ToolRegistry } from '../tool-registry.js';

export interface AgentEvalExpectation {
  /** Every one of these tools must appear somewhere in the real toolTrace. */
  toolsCalled?: ToolName[];
  /** Substrings (case-insensitive) that must appear in the final response text. */
  responseIncludes?: string[];
  /** Substrings that must NOT appear in the final response text. */
  responseExcludes?: string[];
  /** Whether the Output Guard must allow this response through. Defaults to true. */
  guardAllowed?: boolean;
  /** Shallow subset of the real handoffState this turn produced. */
  handoffStateIncludes?: Record<string, unknown>;
}

export interface AgentEvalCase {
  id: string;
  agent: AgentName;
  description: string;
  message: string;
  handoffState?: Record<string, unknown>;
  buildCtx: () => ToolContext;
  /** Overrides the default full ALL_TOOLS registry — for cases that need a scoped tool double
   *  (e.g. isolating "does it call food.lookup with the right args" from the real resolution
   *  waterfall's own data-dependent behavior), matching the same pattern the unit tests use. */
  buildRegistry?: () => ToolRegistry;
  expect: AgentEvalExpectation;
}

export interface AgentEvalCaseResult {
  id: string;
  agent: AgentName;
  description: string;
  passed: boolean;
  failures: string[];
}

export interface AgentEvalSuiteResult {
  results: AgentEvalCaseResult[];
  passRate: number;
  byAgent: Record<string, { total: number; passed: number; passRate: number }>;
}
