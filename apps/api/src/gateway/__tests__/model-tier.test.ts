import { describe, it, expect } from 'vitest';
import { classifyModelTier, isT0Eligible, renderT0Template } from '../model-tier.js';

describe('isT0Eligible / renderT0Template', () => {
  it('is eligible only for known intent tags', () => {
    expect(isT0Eligible('ack_received')).toBe(true);
    expect(isT0Eligible('something_made_up')).toBe(false);
    expect(isT0Eligible(undefined)).toBe(false);
  });

  it('renders a fixed template with variable substitution', () => {
    expect(renderT0Template('scan_confirmed', { productName: 'Maggi Noodles' }))
      .toBe('Confirmed: Maggi Noodles has been logged.');
    expect(renderT0Template('scan_confirmed')).toBe('Confirmed: this item has been logged.');
  });

  it('throws for an unknown tag rather than guessing a response', () => {
    expect(() => renderT0Template('not_a_real_tag')).toThrow(/unknown intentTag/);
  });
});

describe('classifyModelTier', () => {
  it('prefers T0 even when the kill switch is active', () => {
    expect(classifyModelTier({ intentTag: 'goodbye' }, true)).toBe('T0');
  });

  it('defaults to T2 with no hints and no kill switch', () => {
    expect(classifyModelTier({}, false)).toBe('T2');
  });

  it('forces T1 when the kill switch is active', () => {
    expect(classifyModelTier({}, true)).toBe('T1');
  });

  it('honors an explicit low-complexity hint even without the kill switch', () => {
    expect(classifyModelTier({ complexityHint: 'low' }, false)).toBe('T1');
  });

  it('never raises a high-complexity request to T0 from a hint alone', () => {
    expect(classifyModelTier({ complexityHint: 'high' }, false)).toBe('T2');
  });
});
