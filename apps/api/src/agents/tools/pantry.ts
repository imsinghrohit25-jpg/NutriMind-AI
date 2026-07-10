// pantry.state — Phase 13 (§16.3). Real on-hand items + expiry alerts, wrapping
// pantry/expiry-tracker.ts's getExpiryAlerts() for the alert half and a direct query (same table,
// same shape convention as expiry-tracker.ts) for the raw on-hand list.

import type { ToolDefinition, ToolContext } from '../types.js';
import { getExpiryAlerts, type ExpiryAlert } from '../../pantry/expiry-tracker.js';

export interface PantryStateInput {
  expiryWithinDays?: number;
}

export interface PantryOnHandItem {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  purchaseDate: string | null;
  expiryDate: string | null;
}

export interface PantryStateOutput {
  onHand: PantryOnHandItem[];
  expiryAlerts: ExpiryAlert[];
}

export const pantryStateTool: ToolDefinition<PantryStateInput, PantryStateOutput> = {
  name: 'pantry.state',
  description: 'Real on-hand pantry items and expiry alerts for the current user — never a guess at what they have.',
  execute: async (input, ctx) => {
    const [onHandResult, expiryAlerts] = await Promise.all([
      ctx.supabase
        .from('pantry_items')
        .select('id, name, quantity, unit, purchase_date, expiry_date')
        .eq('user_id', ctx.userId)
        .eq('is_consumed', false)
        .order('purchase_date', { ascending: false }),
      getExpiryAlerts({ userId: ctx.userId, withinDays: input.expiryWithinDays ?? 7, supabase: ctx.supabase }),
    ]);

    if (onHandResult.error) throw new Error(`pantry.state: ${onHandResult.error.message}`);

    const onHand: PantryOnHandItem[] = (onHandResult.data ?? []).map((row: Record<string, unknown>) => ({
      itemId: row.id as string,
      name: row.name as string,
      quantity: row.quantity as number,
      unit: row.unit as string,
      purchaseDate: (row.purchase_date as string | null) ?? null,
      expiryDate: (row.expiry_date as string | null) ?? null,
    }));

    return { onHand, expiryAlerts };
  },
};
