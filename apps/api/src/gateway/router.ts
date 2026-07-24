import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LLMProvider, RoutingConfig, ModelTarget } from './provider.js';
import type {
  LLMRequest,
  LLMResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  TaskTier,
} from '@nutrimind/shared';
import { CircuitBreaker } from './circuit-breaker.js';
import { GatewayCache } from './cache.js';
import { CostLogger } from './cost-log.js';
import {
  AllProvidersFailedError,
  ProviderUnavailableError,
  OutputPolicyViolationError,
} from './errors.js';
import { checkOutputPolicy } from '../policy/output-policy.js';
import { AnthropicAdapter } from './adapters/anthropic.js';
import { OpenAIAdapter } from './adapters/openai.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { OpenAICompatAdapter } from './adapters/openai-compat.js';
import { SemanticCache } from './semantic-cache.js';
import { GatewayBackpressure } from './backpressure.js';
import { classifyModelTier, isT0Eligible, renderT0Template } from './model-tier.js';
import { redactLLMRequest } from './pii-redaction.js';

export interface GatewayRouterOptions {
  semanticCache?: SemanticCache;
  backpressure?: GatewayBackpressure;
  /** Phase 12 (§13.3) runaway-cost kill switch — when true, every T2-eligible request is forced
   *  to T1 globally. Injected as a closure (not a supabase client) so this class stays decoupled
   *  from any particular DB client; see gateway/cost-governance.ts for the real implementation
   *  and jobs/registry.ts's ai-cost-budget-check job for what flips it. Omitted = never active,
   *  i.e. byte-identical to pre-Phase-12 behavior. */
  killSwitch?: () => Promise<boolean> | boolean;
}

/** Walks up from this module's own directory looking for `relativePath` — see loadConfig()'s own
 *  comment for why (local-dev-only cwd gap). Throws the original ENOENT-style error by simply
 *  letting readFileSync fail naturally if nothing is found anywhere up the tree. */
function findUpwards(relativePath: string): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    const parentDir = dirname(dir);
    if (parentDir === dir) return relativePath; // give up; let readFileSync raise the real error
    dir = parentDir;
  }
}

export class GatewayRouter {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly providers: Map<string, LLMProvider>,
    private readonly config: RoutingConfig,
    private readonly costLog: CostLogger,
    private readonly cache: GatewayCache,
    private readonly opts: GatewayRouterOptions = {},
  ) {
    for (const providerName of providers.keys()) {
      this.breakers.set(providerName, new CircuitBreaker(providerName));
    }
  }

  // Same cwd-relative gap as apps/api/src/load-env.ts's own header explains (found in the same
  // Gemini/Vision integration session): local dev always runs with cwd = apps/api, but
  // LLM_ROUTING_CONFIG's default ('config/routing.json') lives at the repo root — so the plain
  // cwd-relative resolve() below silently ENOENTs there. Tries the cwd-relative path FIRST
  // (unchanged — this is exactly what already works in production, where the Dockerfile's
  // WORKDIR is the repo root and `config` is copied alongside it); only if that's not found does
  // it walk upward from this module's own directory looking for the same relative path.
  static loadConfig(configPath: string): RoutingConfig {
    const cwdRelative = resolve(process.cwd(), configPath);
    const abs = existsSync(cwdRelative) ? cwdRelative : findUpwards(configPath);
    return JSON.parse(readFileSync(abs, 'utf8')) as RoutingConfig;
  }

  async complete(rawRequest: LLMRequest): Promise<LLMResponse> {
    // T0: fixed-form template, no provider call, no spend, no cache lookups needed at all.
    if (isT0Eligible(rawRequest.intentTag)) {
      const response: LLMResponse = {
        content: renderT0Template(rawRequest.intentTag!),
        provider: 't0-template',
        model: 'deterministic-template',
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        cached: false,
        traceId: rawRequest.traceId,
      };
      await this.costLog.logFromLLMResponse(response, rawRequest.tier, rawRequest.userId);
      return response;
    }

    // Real PII redaction (previously nonexistent at the gateway level — see pii-redaction.ts's
    // own header comment) — applied once, here, before the cache, semantic cache, or ANY
    // provider ever sees the request. Automatic for every provider (Gemini included) by
    // construction: no adapter reads the raw, unredacted request.
    const request = redactLLMRequest(rawRequest);

    const backpressureSlot = this.opts.backpressure?.acquire(request.userId);
    try {
      const cached = this.cache.get(request);
      if (cached) {
        await this.costLog.logFromLLMResponse(cached, request.tier, request.userId);
        return cached;
      }

      if (this.opts.semanticCache) {
        const semanticHit = await this.opts.semanticCache.lookup(
          request,
          (text) => this.embedText(text, request.userId),
        );
        if (semanticHit) {
          await this.costLog.logFromLLMResponse(semanticHit, request.tier, request.userId);
          return semanticHit;
        }
      }

      const policy = this.config[request.tier];
      if (!policy) throw new Error(`No routing policy for tier: ${request.tier}`);

      const killSwitchActive = (await this.opts.killSwitch?.()) ?? false;
      const modelTier = classifyModelTier(request, killSwitchActive);
      const targets: ModelTarget[] =
        modelTier === 'T1' && policy.fast
          ? [policy.fast, policy.primary, ...policy.fallbacks]
          : [policy.primary, ...policy.fallbacks];
      const errors: Error[] = [];

      for (const target of targets) {
        const provider = this.providers.get(target.provider);
        if (!provider) continue;

        const breaker = this.breakers.get(target.provider);
        if (!breaker || breaker.isOpen()) {
          errors.push(new ProviderUnavailableError(target.provider));
          continue;
        }

        try {
          const response = await Promise.race([
            breaker.call(() => provider.complete(request, target.model)),
            this.rejectAfter(policy.timeoutMs, target.provider),
          ]);

          const policyResult = checkOutputPolicy(response.content);
          if (!policyResult.ok) {
            throw new OutputPolicyViolationError(policyResult.violations, response.content);
          }

          this.cache.set(request, response);
          if (this.opts.semanticCache) {
            // Known gap: this re-embeds the same query text lookup() just embedded on a miss
            // (two embedding calls instead of one) — cheap relative to the completion call just
            // made, but a real, documented cost, not a free operation. Reusing lookup()'s
            // embedding here would remove it; not done yet.
            await this.opts.semanticCache.store(request, response, (text) => this.embedText(text, request.userId));
          }
          await this.costLog.logFromLLMResponse(response, request.tier, request.userId);
          return response;
        } catch (err: unknown) {
          if (err instanceof OutputPolicyViolationError) throw err;
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }

      throw new AllProvidersFailedError(request.tier, errors);
    } finally {
      backpressureSlot?.release();
    }
  }

  /**
   * Phase 13 (§16.2: "Streaming responses (SSE/WebSocket) to client, mandatory"). Real
   * token-level streaming — every adapter (gateway/adapters/*.ts) implements `completeStream`
   * natively via its own SDK's streaming API, so this is genuine incremental delivery, not the
   * "whole response as one chunk" simulation copilot/streaming.ts used pre-Phase-13.
   *
   * T0/exact-cache/semantic-cache hits still yield their content as a single chunk (there is
   * nothing to stream — the answer is already fully known before any provider call), which is
   * honest, not a shortcut: streaming exists to reveal a slow LLM call's progress, and none of
   * these three paths make one.
   */
  async *completeStream(rawRequest: LLMRequest): AsyncGenerator<string, LLMResponse, void> {
    if (isT0Eligible(rawRequest.intentTag)) {
      const content = renderT0Template(rawRequest.intentTag!);
      yield content;
      const response: LLMResponse = {
        content, provider: 't0-template', model: 'deterministic-template',
        promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, cached: false,
        traceId: rawRequest.traceId,
      };
      await this.costLog.logFromLLMResponse(response, rawRequest.tier, rawRequest.userId);
      return response;
    }

    // Same real gateway-level PII redaction as complete() — see its own comment above.
    const request = redactLLMRequest(rawRequest);

    const backpressureSlot = this.opts.backpressure?.acquire(request.userId);
    try {
      const cached = this.cache.get(request);
      if (cached) {
        yield cached.content;
        await this.costLog.logFromLLMResponse(cached, request.tier, request.userId);
        return cached;
      }

      if (this.opts.semanticCache) {
        const semanticHit = await this.opts.semanticCache.lookup(
          request, (text) => this.embedText(text, request.userId),
        );
        if (semanticHit) {
          yield semanticHit.content;
          await this.costLog.logFromLLMResponse(semanticHit, request.tier, request.userId);
          return semanticHit;
        }
      }

      const policy = this.config[request.tier];
      if (!policy) throw new Error(`No routing policy for tier: ${request.tier}`);

      const killSwitchActive = (await this.opts.killSwitch?.()) ?? false;
      const modelTier = classifyModelTier(request, killSwitchActive);
      const targets: ModelTarget[] =
        modelTier === 'T1' && policy.fast
          ? [policy.fast, policy.primary, ...policy.fallbacks]
          : [policy.primary, ...policy.fallbacks];
      const errors: Error[] = [];

      for (const target of targets) {
        const provider = this.providers.get(target.provider);
        if (!provider) continue;

        const breaker = this.breakers.get(target.provider);
        if (!breaker || breaker.isOpen()) {
          errors.push(new ProviderUnavailableError(target.provider));
          continue;
        }

        if (!provider.completeStream) {
          // Documented fallback, not silent: every adapter in this codebase implements
          // completeStream today, so this only triggers for a hypothetical future provider that
          // doesn't — it gets a single "chunk" containing the whole response rather than crashing.
          try {
            const response = await Promise.race([
              breaker.call(() => provider.complete(request, target.model)),
              this.rejectAfter(policy.timeoutMs, target.provider),
            ]);
            yield response.content;
            this.cache.set(request, response);
            await this.costLog.logFromLLMResponse(response, request.tier, request.userId);
            return response;
          } catch (err: unknown) {
            errors.push(err instanceof Error ? err : new Error(String(err)));
            continue;
          }
        }

        // Once any chunk from THIS target has reached the caller, a subsequent failure must not
        // silently retry a different provider — the caller has already seen partial output from
        // the failed one, and splicing a second provider's text onto it would be a worse outcome
        // than surfacing the interruption. Only a failure BEFORE the first chunk (breaker OPEN,
        // immediate connection error) is eligible for fallback.
        let yieldedAny = false;
        try {
          let fullContent = '';
          const gen = breaker.callStream(() => provider.completeStream!(request, target.model));
          let result = await Promise.race([gen.next(), this.rejectAfter(policy.timeoutMs, target.provider)]);
          while (!result.done) {
            fullContent += result.value;
            yield result.value;
            yieldedAny = true;
            result = await Promise.race([gen.next(), this.rejectAfter(policy.timeoutMs, target.provider)]);
          }
          const response = result.value;

          const policyResult = checkOutputPolicy(fullContent);
          if (!policyResult.ok) {
            throw new OutputPolicyViolationError(policyResult.violations, fullContent);
          }

          this.cache.set(request, response);
          if (this.opts.semanticCache) {
            await this.opts.semanticCache.store(request, response, (text) => this.embedText(text, request.userId));
          }
          await this.costLog.logFromLLMResponse(response, request.tier, request.userId);
          return response;
        } catch (err: unknown) {
          if (err instanceof OutputPolicyViolationError) throw err;
          if (yieldedAny) throw err; // no fallback once the client has seen partial output
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }

      throw new AllProvidersFailedError(request.tier, errors);
    } finally {
      backpressureSlot?.release();
    }
  }

  private async embedText(text: string, userId?: string): Promise<number[]> {
    const resp = await this.embed({ input: text, traceId: crypto.randomUUID(), userId });
    return resp.embeddings[0] ?? [];
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const policy = this.config['embeddings'];
    if (!policy) throw new Error('No routing policy for embeddings');

    const targets: ModelTarget[] = [policy.primary, ...policy.fallbacks];
    const errors: Error[] = [];

    for (const target of targets) {
      const provider = this.providers.get(target.provider);
      if (!provider?.embed) continue;

      const breaker = this.breakers.get(target.provider);
      if (!breaker || breaker.isOpen()) {
        errors.push(new ProviderUnavailableError(target.provider));
        continue;
      }

      try {
        const response = await Promise.race([
          breaker.call(() => provider.embed!(request, target.model)),
          this.rejectAfter(policy.timeoutMs, target.provider),
        ]);

        await this.costLog.logFromEmbeddingResponse(
          response,
          'embeddings' as TaskTier,
          request.traceId,
          request.userId,
        );
        return response;
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    throw new AllProvidersFailedError('embeddings', errors);
  }

  private rejectAfter(ms: number, provider: string): Promise<never> {
    return new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ProviderUnavailableError(provider)), ms).unref(),
    );
  }

  getCircuitBreakerStates(): Record<string, string> {
    const states: Record<string, string> = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.currentState;
    }
    return states;
  }

  getBackpressureStatus(): { inFlight: number } | null {
    return this.opts.backpressure ? { inFlight: this.opts.backpressure.currentInFlight } : null;
  }
}

export function buildRouter(opts: {
  anthropicKey?: string;
  openaiKey?: string;
  geminiKey?: string;
  openaiCompatBaseUrl?: string;
  openaiCompatKey?: string;
  routingConfigPath: string;
  costLogger: CostLogger;
  cache: GatewayCache;
  routerOptions?: GatewayRouterOptions;
}): GatewayRouter {
  const providers = new Map<string, LLMProvider>();

  if (opts.anthropicKey) {
    providers.set('anthropic', new AnthropicAdapter(opts.anthropicKey));
  }
  if (opts.openaiKey) {
    providers.set('openai', new OpenAIAdapter(opts.openaiKey));
  }
  if (opts.geminiKey) {
    providers.set('gemini', new GeminiAdapter(opts.geminiKey));
  }
  if (opts.openaiCompatBaseUrl) {
    providers.set(
      'openai-compat',
      new OpenAICompatAdapter(opts.openaiCompatBaseUrl, opts.openaiCompatKey),
    );
  }

  const config = GatewayRouter.loadConfig(opts.routingConfigPath);
  return new GatewayRouter(providers, config, opts.costLogger, opts.cache, opts.routerOptions);
}
