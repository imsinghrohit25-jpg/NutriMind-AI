// Grocery Agent — Phase 13 (§16.4.3). Flow: plan/pantry diff -> grocery.list -> pantry-aware
// reduction (expiring items surfaced so they get used before a fresh purchase). Price honesty
// rule: a "cheaper" claim requires a real price-history entry; otherwise phrased as a
// category-level, non-numeric hint — the Output Guard's numeric-claim validator would reject an
// invented rupee figure anyway, this is the agent not even attempting one.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { GroceryListOutput } from '../tools/grocery.js';
import type { PantryStateOutput } from '../tools/pantry.js';
import { explainWithFallback } from '../explain.js';

function buildTemplate(list: GroceryListOutput | null, pantry: PantryStateOutput): string {
  const lines: string[] = [];

  if (list) {
    lines.push(`Shopping list (${list.items.length} items) from ${list.recipesSourced} recipe(s), saved as list ${list.listId}.`);
    const priced = list.items.filter((i) => i.estimatedPrice != null);
    if (priced.length > 0) {
      const total = Math.round(priced.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0));
      lines.push(`Estimated total: ₹${total}.`);
    }
  } else {
    lines.push(`No active meal plan to build a shopping list from yet.`);
  }

  const expiring = pantry.expiryAlerts.filter((a) => a.severity !== 'ok');
  if (expiring.length > 0) {
    lines.push(`Use these up soon: ${expiring.map((a) => a.name).join(', ')}.`);
  }

  return lines.join(' ');
}

export const runGroceryAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('grocery', input.registry, input.ctx);

  const pantry = await call<{ expiryWithinDays?: number }, PantryStateOutput>('pantry.state', {});

  const mealPlanId = input.handoffState.mealPlanId as string | undefined;
  let list: GroceryListOutput | null = null;
  if (mealPlanId) {
    list = await call<{ title: string; mealPlanId: string }, GroceryListOutput>('grocery.list', {
      title: 'Shopping list', mealPlanId,
    });
  }

  const template = buildTemplate(list, pantry);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt:
      'You are a grocery-shopping assistant. Explain the given shopping list and any expiring-item ' +
      'guidance conversationally. Only cite prices that are explicitly given to you — never invent one.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return { responseText, toolTrace: trace, handoffState: list ? { groceryListId: list.listId } : {} };
};
