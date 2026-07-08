// AI Memory System — Layer 1 (episodic) shared types. Phase 11.
// Event taxonomy matches migration 0023's user_events.event_type CHECK constraint exactly —
// keep these in sync (a value here that isn't in the DB constraint will fail at insert time by
// design, not silently).

export type MemoryEventType =
  | 'food_logged'
  | 'meal_planned'
  | 'meal_skipped'
  | 'recipe_cooked'
  | 'barcode_scanned'
  | 'restaurant_visit'
  | 'grocery_purchase'
  | 'biomarker_reading'
  | 'goal_set'
  | 'goal_progress'
  | 'country_transition'
  | 'feedback_given'
  | 'recommendation_accepted'
  | 'recommendation_rejected';

export interface MemoryEventPayloads {
  food_logged: { foodName: string; productId?: string; mealType?: string; energyKcal?: number; quantityG?: number };
  meal_planned: { planId: string; mealType: string; recipeName?: string };
  meal_skipped: { planId: string; mealType: string };
  recipe_cooked: { recipeName: string; cuisine?: string; dietType?: string; mealType?: string };
  barcode_scanned: { barcode: string; resolvedBy: string; productId?: string };
  restaurant_visit: { restaurantName?: string; cuisine?: string };
  grocery_purchase: { itemName: string; category?: string; estimatedPrice?: number; currencyCode?: string };
  biomarker_reading: { biomarkerType: string; value: number; unit: string };
  goal_set: { goal: string; kcalTarget?: number };
  goal_progress: { goal: string; adherencePct: number };
  country_transition: { fromIsoCode?: string; toIsoCode: string };
  feedback_given: { context: string; text: string };
  recommendation_accepted: { recommendationId: string; category: string };
  recommendation_rejected: { recommendationId: string; category: string; reason?: string };
}

export interface MemoryEvent<T extends MemoryEventType = MemoryEventType> {
  eventId: string;
  userId: string;
  eventType: T;
  payload: MemoryEventPayloads[T];
  occurredAt: Date;
  source: string;
}
