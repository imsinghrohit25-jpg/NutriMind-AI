import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      successThreshold: 2,
    });
  });

  it('starts CLOSED', () => {
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('opens after threshold failures', async () => {
    const failing = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow('fail');
    }

    expect(breaker.currentState).toBe('OPEN');
  });

  it('rejects immediately when OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow();
    }

    await expect(breaker.call(() => Promise.resolve(42))).rejects.toThrow(
      /circuit breaker open/i,
    );
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const failing = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow();
    }
    expect(breaker.currentState).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 150));
    expect(breaker.isOpen()).toBe(false);
    expect(breaker.currentState).toBe('HALF_OPEN');
  });

  it('closes after successful calls in HALF_OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow();
    }

    await new Promise((r) => setTimeout(r, 150));

    await breaker.call(() => Promise.resolve('ok'));
    await breaker.call(() => Promise.resolve('ok'));
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('remains open on failure in HALF_OPEN', async () => {
    const failing = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow();
    }

    await new Promise((r) => setTimeout(r, 150));
    breaker.isOpen();

    await expect(breaker.call(failing)).rejects.toThrow('fail');
    expect(breaker.currentState).toBe('OPEN');
  });

  it('reset() clears state to CLOSED', async () => {
    const failing = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failing)).rejects.toThrow();
    }
    expect(breaker.currentState).toBe('OPEN');

    breaker.reset();
    expect(breaker.currentState).toBe('CLOSED');
    const result = await breaker.call(() => Promise.resolve(99));
    expect(result).toBe(99);
  });
});
