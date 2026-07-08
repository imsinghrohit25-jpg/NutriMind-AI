// Expiry tracker — queries pantry items expiring within N days.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExpiryAlert {
  itemId:      string;
  name:        string;
  expiryDate:  string;
  daysUntil:   number;
  severity:    'expired' | 'critical' | 'warning' | 'ok';
}

/** Returns alerts for items expiring within `withinDays` days (default 7). */
export async function getExpiryAlerts(opts: {
  userId:      string;
  withinDays?: number;
  supabase:    SupabaseClient;
}): Promise<ExpiryAlert[]> {
  const { userId, withinDays = 7, supabase } = opts;
  const today    = new Date();
  const cutoff   = new Date(today.getTime() + withinDays * 86400000);

  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, name, expiry_date')
    .eq('user_id', userId)
    .eq('is_consumed', false)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff.toISOString().slice(0, 10))
    .order('expiry_date');

  if (error) throw new Error(`getExpiryAlerts: ${error.message}`);

  return (data ?? []).map((row: any) => {
    const expiry   = new Date(row.expiry_date as string);
    const daysUntil = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
    let severity: ExpiryAlert['severity'];
    if (daysUntil < 0)     severity = 'expired';
    else if (daysUntil <= 1) severity = 'critical';
    else if (daysUntil <= 3) severity = 'warning';
    else                     severity = 'ok';

    return {
      itemId:     row.id as string,
      name:       row.name as string,
      expiryDate: row.expiry_date as string,
      daysUntil,
      severity,
    };
  });
}
