import { describe, it, expect } from 'vitest';
import { getGroceryProvider, INDIA_GROCERY_PROVIDER, US_GROCERY_PROVIDER, UK_GROCERY_PROVIDER } from '../registry.js';

describe('Grocery Price Provider registry', () => {
  it('resolves IN to the India provider', () => {
    expect(getGroceryProvider('IN')).toBe(INDIA_GROCERY_PROVIDER);
    expect(getGroceryProvider('in')).toBe(INDIA_GROCERY_PROVIDER); // case-insensitive
  });

  it('resolves US to the US provider', () => {
    expect(getGroceryProvider('US')).toBe(US_GROCERY_PROVIDER);
  });

  it('resolves GB to the UK provider', () => {
    expect(getGroceryProvider('GB')).toBe(UK_GROCERY_PROVIDER);
  });

  it('falls back to India for an unregistered country', () => {
    expect(getGroceryProvider('FR')).toBe(INDIA_GROCERY_PROVIDER);
  });

  it('falls back to India for null/undefined', () => {
    expect(getGroceryProvider(null)).toBe(INDIA_GROCERY_PROVIDER);
    expect(getGroceryProvider(undefined)).toBe(INDIA_GROCERY_PROVIDER);
  });

  it('every provider declares a currency code and at least one country', () => {
    for (const provider of [INDIA_GROCERY_PROVIDER, US_GROCERY_PROVIDER, UK_GROCERY_PROVIDER]) {
      expect(provider.currencyCode).toBeTruthy();
      expect(provider.isoCountryCodes.length).toBeGreaterThan(0);
    }
  });
});
