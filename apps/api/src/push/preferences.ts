// Push notification preferences — per-user opt-in/out for each notification type.
// Stored in the `push_preferences` Supabase table.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PushPreferences {
  weeklyReport:      boolean;
  allergenAlert:     boolean;
  budgetOverrun:     boolean;
  scanReminder:      boolean;   // "You haven't scanned anything today"
}

const DEFAULT_PREFERENCES: PushPreferences = {
  weeklyReport:  true,
  allergenAlert: true,   // allergen alerts default ON — safety critical
  budgetOverrun: true,
  scanReminder:  false,  // opt-in only
};

export async function getPreferences(
  userId: string,
  supabase: SupabaseClient,
): Promise<PushPreferences> {
  const { data } = await supabase
    .from('push_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  return { ...DEFAULT_PREFERENCES, ...(data?.preferences as Partial<PushPreferences> ?? {}) };
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<PushPreferences>,
  supabase: SupabaseClient,
): Promise<void> {
  const current = await getPreferences(userId, supabase);
  const merged  = { ...current, ...prefs };

  await supabase.from('push_preferences').upsert({
    user_id:     userId,
    preferences: merged,
    updated_at:  new Date().toISOString(),
  });
}
