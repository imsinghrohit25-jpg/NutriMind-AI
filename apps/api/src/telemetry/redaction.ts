import type { Context } from '@opentelemetry/api';
import type { Span as SDKSpan } from '@opentelemetry/sdk-trace-node';

const SENSITIVE_ATTRIBUTE_PATTERNS = [
  /health_condition/i,
  /allerg/i,
  /disease/i,
  /diagnosis/i,
  /medication/i,
  /\bbmi\b/i,
  /user\.email/i,
  /user\.phone/i,
];

const REDACTED = '[redacted]';

export function redactAttributes(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const isSensitive = SENSITIVE_ATTRIBUTE_PATTERNS.some((pat) => pat.test(key));
    clean[key] = isSensitive ? REDACTED : value;
  }
  return clean;
}

export interface MinimalSpanProcessor {
  onStart(span: SDKSpan, parentContext: Context): void;
  onEnd(span: SDKSpan): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export class HealthDataRedactionProcessor implements MinimalSpanProcessor {
  constructor(private readonly delegate: MinimalSpanProcessor) {}

  onStart(span: SDKSpan, context: Context): void {
    this.delegate.onStart(span, context);
  }

  onEnd(span: SDKSpan): void {
    const attrs = span.attributes as Record<string, unknown>;
    const redacted = redactAttributes(attrs);
    Object.assign(attrs, redacted);
    this.delegate.onEnd(span);
  }

  async shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }
}
