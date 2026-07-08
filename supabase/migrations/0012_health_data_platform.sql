-- Phase 13: Health Data Platform — Wearables + Fitness
-- Tables: health_metric_types, health_metrics, health_consents, oauth_tokens, sync_anchors

-- ── Metric type registry ────────────────────────────────────────────────────
create table if not exists health_metric_types (
  metric_type  text primary key,
  display_name text not null,
  unit_default text not null,
  is_sensitive boolean not null default false,  -- glucose, weight → true
  description  text
);

insert into health_metric_types (metric_type, display_name, unit_default, is_sensitive, description)
values
  ('steps',           'Steps',               'count',  false, 'Daily step count'),
  ('active_energy',   'Active Energy',       'kcal',   false, 'Calories burned via activity'),
  ('resting_energy',  'Resting Energy',      'kcal',   false, 'Basal metabolic energy'),
  ('heart_rate',      'Heart Rate',          'bpm',    false, 'Heart rate samples'),
  ('weight',          'Body Weight',         'kg',     true,  'Body weight measurements'),
  ('sleep_duration',  'Sleep Duration',      'minutes',false, 'Total sleep time per night'),
  ('workout',         'Workout',             'minutes',false, 'Workout sessions'),
  ('blood_glucose',   'Blood Glucose',       'mg/dL',  true,  'Blood glucose readings'),
  ('hrv',             'Heart Rate Variability','ms',   false, 'HRV measurements'),
  ('oxygen_saturation','Blood Oxygen',       'percent',false, 'SpO2 readings')
on conflict (metric_type) do nothing;

-- ── Per-datatype consent ─────────────────────────────────────────────────────
-- Users must explicitly grant each metric_type; revocation stops sync AND
-- triggers deletion of previously-synced data (enforced via consent.ts).
create table if not exists health_consents (
  user_id          uuid    not null references auth.users(id) on delete cascade,
  metric_type      text    not null references health_metric_types(metric_type),
  granted          boolean not null default false,
  consent_version  int     not null default 1,
  granted_at       timestamptz,
  revoked_at       timestamptz,
  updated_at       timestamptz default now(),
  primary key (user_id, metric_type)
);

-- ── Unified health metrics ────────────────────────────────────────────────────
-- All platform adapters normalise into this table.
-- external_id: platform-specific ID used for idempotent upsert / deduplication.
-- Dedup rule: UNIQUE(user_id, external_id) — same event from watch + phone uses
--   the same external_id so only one row is stored.
create table if not exists health_metrics (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  metric_type     text        not null references health_metric_types(metric_type),
  value           numeric     not null,
  unit            text        not null,
  start_time      timestamptz not null,
  end_time        timestamptz,
  source_platform text        not null,  -- 'healthkit' | 'health_connect' | 'fitbit' | 'garmin' | 'manual'
  source_device   text,
  external_id     text        not null,  -- required; built by adapter
  sync_batch      uuid,
  created_at      timestamptz default now(),
  constraint health_metrics_external_id_unique unique (user_id, external_id)
);

create index if not exists health_metrics_user_type_time_idx
  on health_metrics (user_id, metric_type, start_time desc);

create index if not exists health_metrics_user_time_idx
  on health_metrics (user_id, start_time desc);

-- ── OAuth tokens for cloud connectors (Fitbit, Garmin) ─────────────────────
-- access_token and refresh_token stored as-is; encrypt at rest via Postgres
-- transparent data encryption or application-layer encryption (see ADR-0009).
create table if not exists oauth_tokens (
  user_id       uuid    not null references auth.users(id) on delete cascade,
  provider      text    not null,   -- 'fitbit' | 'garmin'
  access_token  text    not null,
  refresh_token text,
  expires_at    timestamptz,
  scopes        text[],
  provider_user_id text,            -- provider's own user ID for webhook routing
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (user_id, provider)
);

-- ── Incremental sync anchors ─────────────────────────────────────────────────
create table if not exists sync_anchors (
  user_id         uuid    not null references auth.users(id) on delete cascade,
  source_platform text    not null,
  last_sync_at    timestamptz not null default now(),
  anchor_value    text,              -- platform cursor/marker for incremental pull
  updated_at      timestamptz default now(),
  primary key (user_id, source_platform)
);

-- ── RLS policies ─────────────────────────────────────────────────────────────
alter table health_consents   enable row level security;
alter table health_metrics    enable row level security;
alter table oauth_tokens      enable row level security;
alter table sync_anchors      enable row level security;

-- Users own their own data
create policy "Users manage own health consents"
  on health_consents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own health metrics"
  on health_metrics for select
  using (auth.uid() = user_id);

create policy "Users insert own health metrics"
  on health_metrics for insert
  with check (auth.uid() = user_id);

create policy "Users delete own health metrics"
  on health_metrics for delete
  using (auth.uid() = user_id);

create policy "Users manage own oauth tokens"
  on oauth_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own sync anchors"
  on sync_anchors for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role has full access (backend workers)
create policy "Service role full access health_consents"
  on health_consents for all using (auth.role() = 'service_role');

create policy "Service role full access health_metrics"
  on health_metrics for all using (auth.role() = 'service_role');

create policy "Service role full access oauth_tokens"
  on oauth_tokens for all using (auth.role() = 'service_role');

create policy "Service role full access sync_anchors"
  on sync_anchors for all using (auth.role() = 'service_role');

-- health_metric_types is public read (no PII)
alter table health_metric_types enable row level security;
create policy "Anyone reads metric types"
  on health_metric_types for select using (true);
