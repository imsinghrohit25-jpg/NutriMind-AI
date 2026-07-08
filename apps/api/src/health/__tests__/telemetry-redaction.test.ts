// Gate: health metrics absent from telemetry (redaction extended for Phase 13 types).

import { describe, it, expect } from 'vitest';
import { redactAttributes } from '../../telemetry/redaction.js';

describe('health data telemetry redaction (Phase 13 extension)', () => {
  const SENSITIVE_KEYS = [
    'blood_glucose',
    'health_metric',
    'health_metric_value',
    'lab_result',
    'biomarker',
    'wearable_data',
    'glucose_reading',
    'user.weight',
    'user.bmi',
    'health_condition',
    'allergy',
    'disease',
  ];

  for (const key of SENSITIVE_KEYS) {
    it(`redacts attribute "${key}"`, () => {
      const attrs = { [key]: 42, safe_field: 'hello' };
      const cleaned = redactAttributes(attrs);
      expect(cleaned[key]).toBe('[redacted]');
      expect(cleaned['safe_field']).toBe('hello');
    });
  }

  it('does not redact non-sensitive attributes', () => {
    const attrs = { request_id: 'abc', route: '/api/scan', duration_ms: 120 };
    const cleaned = redactAttributes(attrs);
    expect(cleaned['request_id']).toBe('abc');
    expect(cleaned['route']).toBe('/api/scan');
    expect(cleaned['duration_ms']).toBe(120);
  });
});
