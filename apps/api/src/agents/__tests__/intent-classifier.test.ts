import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../intent-classifier.js';

describe('classifyIntent — keyword fallback (no gateway configured, real path for this environment)', () => {
  it('defaults to the Nutrition Agent for a generic food question', async () => {
    const result = await classifyIntent('roti sabzi me kitna protein hai?', null);
    expect(result.agents).toEqual(['nutrition']);
    expect(result.method).toBe('keyword_fallback');
  });

  it('routes a lab-report question to the Biomarker Agent', async () => {
    const result = await classifyIntent('My HbA1c came back high, what should I eat?', null);
    expect(result.agents).toContain('biomarker');
  });

  it('routes a menu question to the Restaurant Agent', async () => {
    const result = await classifyIntent('Scanned this restaurant menu, what should I order?', null);
    expect(result.agents).toContain('restaurant');
  });

  it('ADVERSARIAL/multi-intent acceptance scenario: Hinglish travel + meal plan -> Travel -> Meal Planning -> Grocery chain', async () => {
    const result = await classifyIntent('main agle hafte Dubai ja raha hoon, meal plan adjust karo', null);
    expect(result.agents).toEqual(['travel_nutrition', 'meal_planning', 'grocery']);
  });

  it('detects travel intent from a recognized city even without an explicit "going to" verb', async () => {
    const result = await classifyIntent('Dubai next week, any tips?', null);
    expect(result.agents).toContain('travel_nutrition');
  });

  it('cascades meal_planning -> grocery even for a plain English meal-plan request with no travel context', async () => {
    const result = await classifyIntent('Please adjust my meal plan for this week', null);
    expect(result.agents).toEqual(['meal_planning', 'grocery']);
  });

  it('never invents an agent that isn\'t in the known list', async () => {
    const result = await classifyIntent('asdkjhasdkjh random gibberish', null);
    expect(result.agents.every((a) => typeof a === 'string')).toBe(true);
    expect(result.agents).toEqual(['nutrition']); // safe default, not a guess
  });
});

describe('classifyIntent — LLM path', () => {
  it('uses the LLM classification when the gateway succeeds and returns valid JSON', async () => {
    const gateway = {
      complete: async () => ({
        content: '{"agents": ["grocery"], "confidence": 0.9}',
        provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1,
        costUsd: 0, latencyMs: 1, cached: false, traceId: 't1',
      }),
    };
    const result = await classifyIntent('what should I buy', gateway as never);
    expect(result.method).toBe('llm');
    expect(result.agents).toEqual(['grocery']);
  });

  it('falls back to keyword classification when the LLM returns unparseable content', async () => {
    const gateway = { complete: async () => ({
      content: 'not json at all', provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1,
      costUsd: 0, latencyMs: 1, cached: false, traceId: 't1',
    }) };
    const result = await classifyIntent('My HbA1c is high', gateway as never);
    expect(result.method).toBe('keyword_fallback');
    expect(result.agents).toContain('biomarker');
  });

  it('falls back to keyword classification when the LLM call throws', async () => {
    const gateway = { complete: async () => { throw new Error('provider down'); } };
    const result = await classifyIntent('My HbA1c is high', gateway as never);
    expect(result.method).toBe('keyword_fallback');
  });

  it('falls back when the LLM invents an agent name that does not exist', async () => {
    const gateway = { complete: async () => ({
      content: '{"agents": ["made_up_agent"], "confidence": 0.9}',
      provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1,
      costUsd: 0, latencyMs: 1, cached: false, traceId: 't1',
    }) };
    const result = await classifyIntent('roti sabzi', gateway as never);
    expect(result.method).toBe('keyword_fallback');
  });
});
