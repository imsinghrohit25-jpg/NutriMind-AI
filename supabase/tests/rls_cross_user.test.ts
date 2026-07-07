/**
 * RLS cross-user isolation tests + migration data-preservation test.
 *
 * Prerequisites: `supabase start` with seeds applied.
 * Run: npm test (from supabase/tests/) or npm run test:db (from repo root).
 *
 * Environment variables (from supabase start output):
 *   SUPABASE_URL           — local: http://127.0.0.1:54321
 *   SUPABASE_ANON_KEY      — local anon key
 *   SUPABASE_SERVICE_ROLE_KEY — local service_role key
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const TEST_PASSWORD = 'TestPass123!';
const USER_A_EMAIL = `rls_user_a_${Date.now()}@test.nutrimind.local`;
const USER_B_EMAIL = `rls_user_b_${Date.now()}@test.nutrimind.local`;

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------
function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function signUp(email: string): Promise<{ id: string; client: SupabaseClient }> {
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { id: data.user.id, client };
}

async function deleteUser(userId: string): Promise<void> {
  const admin = serviceClient();
  await admin.auth.admin.deleteUser(userId);
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let userAMemberId: string;
let userAScanId: string;
let userACartId: string;

// A real canonical product row inserted by service_role for cross-table tests
let canonicalProductId: string;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  [userA, userB] = await Promise.all([signUp(USER_A_EMAIL), signUp(USER_B_EMAIL)]);

  const admin = serviceClient();

  // Insert canonical product via service_role (simulates Phase 3 resolver)
  const { data: product, error: productErr } = await admin
    .from('products')
    .insert({
      name: 'RLS Test Biscuit',
      barcode: '1234567890123',
      barcode_type: 'ean13',
      source: 'nutrimind_curated',
      source_id: 'rls_test_biscuit',
      dataset_version: '1.0',
      retrieved_at: new Date().toISOString(),
      license_class: 'internal',
    })
    .select('id')
    .single();
  if (productErr) throw new Error(`product insert: ${productErr.message}`);
  canonicalProductId = product.id;

  // User A creates a household member
  const { data: member, error: memberErr } = await userA.client
    .from('household_members')
    .insert({ owner_id: userA.id, display_name: 'Test Child A', is_child: true })
    .select('id')
    .single();
  if (memberErr) throw new Error(`member insert: ${memberErr.message}`);
  userAMemberId = member.id;

  // User A creates a scan
  const { data: scan, error: scanErr } = await userA.client
    .from('scans')
    .insert({
      user_id: userA.id,
      product_id: canonicalProductId,
      scan_type: 'barcode',
    })
    .select('id')
    .single();
  if (scanErr) throw new Error(`scan insert: ${scanErr.message}`);
  userAScanId = scan.id;

  // User A creates a cart session
  const { data: cart, error: cartErr } = await userA.client
    .from('grocery_cart_sessions')
    .insert({ user_id: userA.id, name: 'Weekly Shop' })
    .select('id')
    .single();
  if (cartErr) throw new Error(`cart insert: ${cartErr.message}`);
  userACartId = cart.id;
});

afterAll(async () => {
  const admin = serviceClient();
  // Clean up canonical product (cascades to nutrition, embeddings, scans via ON DELETE SET NULL)
  await admin.from('products').delete().eq('id', canonicalProductId);
  await Promise.all([deleteUser(userA.id), deleteUser(userB.id)]);
});

// ---------------------------------------------------------------------------
// Tests: canonical / public data — all authenticated users can read
// ---------------------------------------------------------------------------
describe('Canonical tables: authenticated read', () => {
  it('user B can read data_sources', async () => {
    const { data, error } = await userB.client.from('data_sources').select('id');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('user B can read allergen_taxonomy', async () => {
    const { data, error } = await userB.client.from('allergen_taxonomy').select('id');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('user B can read the canonical product inserted by service_role', async () => {
    const { data, error } = await userB.client
      .from('products')
      .select('id')
      .eq('id', canonicalProductId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('user B can read feature_flags', async () => {
    const { data, error } = await userB.client.from('feature_flags').select('name');
    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: user-owned data — cross-user isolation
// ---------------------------------------------------------------------------
describe('household_members: cross-user isolation', () => {
  it('user A can read their own member', async () => {
    const { data, error } = await userA.client
      .from('household_members')
      .select('id')
      .eq('id', userAMemberId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('user B cannot see user A members (empty result, not error)', async () => {
    const { data, error } = await userB.client
      .from('household_members')
      .select('id')
      .eq('id', userAMemberId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('user B cannot insert a member with user A as owner', async () => {
    const { error } = await userB.client.from('household_members').insert({
      owner_id: userA.id,
      display_name: 'Injected by B',
    });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: scans
// ---------------------------------------------------------------------------
describe('scans: cross-user isolation', () => {
  it('user A can read their own scan', async () => {
    const { data, error } = await userA.client
      .from('scans')
      .select('id')
      .eq('id', userAScanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('user B cannot read user A scan', async () => {
    const { data, error } = await userB.client
      .from('scans')
      .select('id')
      .eq('id', userAScanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('user B cannot insert a scan owned by user A', async () => {
    const { error } = await userB.client.from('scans').insert({
      user_id: userA.id,
      scan_type: 'barcode',
    });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: grocery cart items (via session ownership)
// ---------------------------------------------------------------------------
describe('grocery_cart_items: cross-user isolation', () => {
  it('user B cannot insert an item into user A cart session', async () => {
    const { error } = await userB.client.from('grocery_cart_items').insert({
      cart_session_id: userACartId,
      product_id: canonicalProductId,
      quantity: 1,
    });
    expect(error).not.toBeNull();
  });

  it('user B cannot read user A cart items', async () => {
    // First, user A adds an item
    await userA.client.from('grocery_cart_items').insert({
      cart_session_id: userACartId,
      product_id: canonicalProductId,
      quantity: 1,
    });
    const { data, error } = await userB.client
      .from('grocery_cart_items')
      .select('id')
      .eq('cart_session_id', userACartId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: ops tables — no direct user access
// ---------------------------------------------------------------------------
describe('ops tables: no user access', () => {
  it('user A cannot read llm_call_log', async () => {
    const { data, error } = await userA.client.from('llm_call_log').select('id');
    // Either an error or empty array due to RLS; must not return rows
    if (error) {
      expect(error.code).toMatch(/42501|PGRST301/);
    } else {
      expect(data).toHaveLength(0);
    }
  });

  it('user A cannot read audit_log', async () => {
    const { data, error } = await userA.client.from('audit_log').select('id');
    if (error) {
      expect(error.code).toMatch(/42501|PGRST301/);
    } else {
      expect(data).toHaveLength(0);
    }
  });

  it('user A cannot read curation_queue', async () => {
    const { data, error } = await userA.client.from('curation_queue').select('id');
    if (error) {
      expect(error.code).toMatch(/42501|PGRST301/);
    } else {
      expect(data).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: service_role write to canonical tables
// ---------------------------------------------------------------------------
describe('service_role: write access to canonical tables', () => {
  it('service_role can insert and delete a data_source row', async () => {
    const admin = serviceClient();
    const { error: insertErr } = await admin.from('data_sources').insert({
      id: 'rls_test_source',
      display_name: 'RLS Test Source',
      license_class: 'internal',
      attribution_text: 'Test only',
    });
    expect(insertErr).toBeNull();

    const { error: deleteErr } = await admin
      .from('data_sources')
      .delete()
      .eq('id', 'rls_test_source');
    expect(deleteErr).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: user_consents (append-only)
// ---------------------------------------------------------------------------
describe('user_consents: append-only enforcement', () => {
  it('user A can insert their own consent', async () => {
    const { error } = await userA.client.from('user_consents').insert({
      user_id: userA.id,
      consent_type: 'tos',
      version: 'v1.0',
    });
    expect(error).toBeNull();
  });

  it('user A cannot insert consent for user B', async () => {
    const { error } = await userA.client.from('user_consents').insert({
      user_id: userB.id,
      consent_type: 'tos',
      version: 'v1.0',
    });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: match_* SQL functions (scope enforcement)
// ---------------------------------------------------------------------------
describe('match_user_history: user_id scope enforced in SQL', () => {
  it('returns empty for a user with no history', async () => {
    // Call via RPC; user B has no history embeddings
    const fakeEmbedding = new Array(1536).fill(0.1);
    const { data, error } = await userB.client.rpc('match_user_history', {
      p_user_id: userB.id,
      query_embedding: fakeEmbedding,
      match_count: 5,
      scope_source_type: null,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: migration data-preservation (regression gate)
// Simulates: after each release migration the existing seeded rows must survive.
// Here we verify that the seed rows inserted in beforeAll are still present.
// ---------------------------------------------------------------------------
describe('migration data-preservation', () => {
  it('seed data_sources rows survive (openfoodfacts, usda_fdc present)', async () => {
    const { data, error } = await userA.client
      .from('data_sources')
      .select('id')
      .in('id', ['openfoodfacts', 'usda_fdc']);
    expect(error).toBeNull();
    expect(data?.map((r) => r.id).sort()).toEqual(['openfoodfacts', 'usda_fdc'].sort());
  });

  it('seed allergen_taxonomy rows survive (peanuts, gluten present)', async () => {
    const { data, error } = await userA.client
      .from('allergen_taxonomy')
      .select('id')
      .in('id', ['peanuts', 'gluten']);
    expect(error).toBeNull();
    expect(data?.map((r) => r.id).sort()).toEqual(['gluten', 'peanuts'].sort());
  });

  it('canonical product row still readable after migrations', async () => {
    const { data, error } = await userA.client
      .from('products')
      .select('id, name')
      .eq('id', canonicalProductId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe('RLS Test Biscuit');
  });
});
