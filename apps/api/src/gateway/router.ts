import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

export class GatewayRouter {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly providers: Map<string, LLMProvider>,
    private readonly config: RoutingConfig,
    private readonly costLog: CostLogger,
    private readonly cache: GatewayCache,
  ) {
    for (const providerName of providers.keys()) {
      this.breakers.set(providerName, new CircuitBreaker(providerName));
    }
  }

  static loadConfig(configPath: string): RoutingConfig {
    const abs = resolve(process.cwd(), configPath);
    return JSON.parse(readFileSync(abs, 'utf8')) as RoutingConfig;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const cached = this.cache.get(request);
    if (cached) {
      await this.costLog.logFromLLMResponse(cached, request.tier, request.userId);
      return cached;
    }

    const policy = this.config[request.tier];
    if (!policy) throw new Error(`No routing policy for tier: ${request.tier}`);

    const targets: ModelTarget[] = [policy.primary, ...policy.fallbacks];
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
        await this.costLog.logFromLLMResponse(response, request.tier, request.userId);
        return response;
      } catch (err: unknown) {
        if (err instanceof OutputPolicyViolationError) throw err;
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    throw new AllProvidersFailedError(request.tier, errors);
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
  return new GatewayRouter(providers, config, opts.costLogger, opts.cache);
}
