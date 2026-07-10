import { describe, it, expect, vi } from 'vitest';
import { runSupervisor } from '../supervisor.js';
import type { SpecialistAgentRunner } from '../agent-runner.js';

function makeCtx(gateway: unknown = null) {
  return { gateway } as never;
}

describe('runSupervisor — the Supervisor graph', () => {
  it('classifies, dispatches to one agent, and terminates through the Output Guard', async () => {
    const nutritionRunner: SpecialistAgentRunner = vi.fn(async () => ({
      responseText: 'This has 400mg sodium.',
      toolTrace: [{ tool: 'nutrition.compute' as const, output: { per100g: { sodiumMg: 400 } } }],
    }));

    const result = await runSupervisor({ nutrition: nutritionRunner }, {
      message: 'kitna sodium hai isme?', ctx: makeCtx(), registry: {} as never,
    });

    expect(result.plan).toEqual(['nutrition']);
    expect(nutritionRunner).toHaveBeenCalledOnce();
    expect(result.guardResult.allowed).toBe(true);
    expect(result.guardResult.finalText).toContain('400mg sodium');
  });

  it('runs a multi-agent plan sequentially, passing structured handoffState between agents', async () => {
    const calls: string[] = [];
    const travelRunner: SpecialistAgentRunner = vi.fn(async () => {
      calls.push('travel');
      return {
        responseText: 'Switched to UAE.',
        toolTrace: [{ tool: 'country.transition' as const, output: { isoCode: 'AE' } }],
        handoffState: { newCountryIsoCode: 'AE' },
      };
    });
    const mealPlanningRunner: SpecialistAgentRunner = vi.fn(async (input) => {
      calls.push('meal_planning');
      // Real structured handoff, not free text — the country code from the Travel agent is
      // available here as real state, not re-derived from a text summary.
      expect(input.handoffState.newCountryIsoCode).toBe('AE');
      return {
        responseText: 'Meal plan adjusted for UAE.',
        toolTrace: [{ tool: 'mealplan.generate' as const, output: { days: [{ totalKcal: 1900 }] } }],
      };
    });
    const groceryRunner: SpecialistAgentRunner = vi.fn(async () => {
      calls.push('grocery');
      return { responseText: 'Grocery list updated.', toolTrace: [] };
    });

    const result = await runSupervisor(
      { travel_nutrition: travelRunner, meal_planning: mealPlanningRunner, grocery: groceryRunner },
      { message: 'main agle hafte Dubai ja raha hoon, meal plan adjust karo', ctx: makeCtx(), registry: {} as never },
    );

    expect(result.plan).toEqual(['travel_nutrition', 'meal_planning', 'grocery']);
    expect(calls).toEqual(['travel', 'meal_planning', 'grocery']);
    expect(result.guardResult.allowed).toBe(true);
    expect(result.guardResult.finalText).toContain('Switched to UAE');
    expect(result.guardResult.finalText).toContain('Meal plan adjusted');
    expect(result.guardResult.finalText).toContain('Grocery list updated');
  });

  it('the Output Guard rejects the ENTIRE multi-agent response if any agent\'s numeric claim is fabricated', async () => {
    const runnerA: SpecialistAgentRunner = vi.fn(async () => ({
      responseText: 'Real value: 100mg.',
      toolTrace: [{ tool: 'nutrition.compute' as const, output: { per100g: { sodiumMg: 100 } } }],
    }));
    const runnerB: SpecialistAgentRunner = vi.fn(async () => ({
      responseText: 'Fabricated value: 9999mg.', // never appears in any tool trace
      toolTrace: [{ tool: 'nutrition.compute' as const, output: { per100g: { sodiumMg: 100 } } }],
    }));

    const result = await runSupervisor({ nutrition: runnerA, grocery: runnerB }, {
      message: 'kitna sodium hai isme? grocery list bhi banao', ctx: makeCtx(), registry: {} as never,
    });

    expect(result.guardResult.allowed).toBe(false);
    expect(result.guardResult.rejectionReason).toContain('9999');
  });

  it('handles a classified agent with no registered runner honestly — never silently drops it', async () => {
    const result = await runSupervisor({}, {
      message: 'roti sabzi me kitna protein hai?', ctx: makeCtx(), registry: {} as never,
    });

    expect(result.plan).toEqual(['nutrition']);
    expect(result.guardResult.finalText).toContain('nutrition agent not available');
  });

  it('appends the medical disclaimer when the Biomarker agent flags one, even in a multi-agent plan', async () => {
    const biomarkerRunner: SpecialistAgentRunner = vi.fn(async () => ({
      responseText: 'Your glucose trend is rising.',
      toolTrace: [{ tool: 'biomarker.trends' as const, output: { trend: { slopePerWeek: 2 } } }],
      requiresMedicalDisclaimer: true,
    }));

    const result = await runSupervisor({ biomarker: biomarkerRunner }, {
      message: 'my hba1c results', ctx: makeCtx(), registry: {} as never,
    });

    expect(result.guardResult.finalText).toContain('consult a qualified clinician');
  });
});
