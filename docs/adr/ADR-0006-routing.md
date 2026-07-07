# ADR-0006 — AI Gateway: Task-Tier Routing Policy

**Date:** 2026-07-07  
**Status:** Accepted  
**Phase:** 2

## Context

NutriMind calls four LLM providers (Anthropic, OpenAI, Gemini, OpenAI-compatible) for tasks
with very different cost/latency/quality requirements. A single model choice is both expensive
and fragile (provider outage = full outage).

## Decision

**Task-tier routing**: every LLM call is tagged with a `TaskTier` enum. A policy table in
`config/routing.json` maps each tier to an ordered list of provider/model targets. The gateway
router tries them in order with per-provider circuit breakers and timeouts.

## Task tiers

| Tier | Purpose | Primary model | Cost target |
|---|---|---|---|
| `parse_assist` | Label OCR disambiguation, ingredient name normalisation | Claude Haiku 4.5 | < $0.001/call |
| `vision_analysis` | Meal photo → dish + portion estimation | Claude Sonnet 4.6 | < $0.05/call |
| `copilot_reasoning` | Health Copilot multi-turn Q&A with RAG grounding | Claude Sonnet 4.6 | < $0.10/call |
| `report_generation` | Weekly report narrative (long context) | Claude Sonnet 4.6 | < $0.20/call |
| `embeddings` | Product, knowledge-chunk, user-history vectors (1536-dim) | text-embedding-3-small | < $0.001/1k tokens |

## Fallback chains

```json
parse_assist:   Anthropic Haiku → OpenAI gpt-4o-mini → Gemini 1.5 Flash
vision_analysis: Anthropic Sonnet → OpenAI gpt-4o
copilot_reasoning: Anthropic Sonnet → OpenAI gpt-4o → Gemini 1.5 Pro
report_generation: Anthropic Sonnet → OpenAI gpt-4o
embeddings:     OpenAI text-embedding-3-small → Gemini text-embedding-004
```

## Circuit breaker

Per-provider `CircuitBreaker` (in `gateway/circuit-breaker.ts`):
- **CLOSED** → normal operation
- **OPEN** after 3 consecutive failures; all calls rejected immediately for 30s
- **HALF_OPEN** after 30s; 1 trial call allowed; 2 consecutive successes → CLOSED

## Cost logging

Every call (success or failure) is recorded to `public.llm_call_log` with:
`trace_id, user_id, task_tier, provider, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, cached, success`

Grafana dashboard (`observability/grafana/dashboards/llm-costs.json`) surfaces:
- Hourly cost by provider/model
- Request rate by tier
- P95 latency by provider
- Circuit breaker state per provider

## Output policy

All LLM responses pass through `policy/output-policy.ts` before being returned to the caller.
Policy blocks: diagnosis/cure language, stop-medication instructions, score-contradicting claims.
Violations are logged with the trace_id and return HTTP 422.

## Caching

Zero-temperature calls are cached in-process with SHA-256 key of `{tier, messages, systemPrompt}`.
TTL: 5 minutes. Cache hit → cost logged as zero-latency cached hit (still logged to llm_call_log).

## Consequences

- Adding a new provider = new `LLMProvider` implementation + entry in routing.json. No other changes.
- Cost budget alert fires when `SUM(cost_usd) WHERE called_at > NOW() - INTERVAL '30 days' > LLM_MONTHLY_BUDGET_USD`.
- The `openai-compat` adapter covers Ollama/vLLM local deployments for development.

## Review triggers

- If Anthropic releases a cheaper capable model → update catalog.ts + routing.json
- If a provider changes pricing > 20% → update catalog.ts and re-run cost projections
- If circuit breaker false-positives increase (→ raise failureThreshold or add jitter)
