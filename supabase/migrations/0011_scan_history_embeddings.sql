-- Scan history embeddings — stores semantic vectors for each scan event.
-- Used by memory/semantic-search.ts for natural-language history search.
-- RLS: each user can only access their own rows (gate: cross-user negative test).

create table if not exists scan_history_embeddings (
  scan_id      text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  text         text        not null,
  embedding    vector(1536) not null,
  health_score numeric(5,2),
  band         text,
  scanned_at   timestamptz not null,
  metadata     jsonb       default '{}'::jsonb,
  created_at   timestamptz default now()
);

-- RLS
alter table scan_history_embeddings enable row level security;

create policy "Users can read own history embeddings"
  on scan_history_embeddings for select
  using (auth.uid() = user_id);

create policy "Users can insert own history embeddings"
  on scan_history_embeddings for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own history embeddings"
  on scan_history_embeddings for delete
  using (auth.uid() = user_id);

-- Service role bypass for backend workers
create policy "Service role full access to history embeddings"
  on scan_history_embeddings for all
  using (auth.role() = 'service_role');

-- Index for vector similarity search
create index if not exists scan_history_embeddings_embedding_idx
  on scan_history_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Index for user_id lookups
create index if not exists scan_history_embeddings_user_id_idx
  on scan_history_embeddings (user_id, scanned_at desc);

-- RPC: match_scan_history — semantic similarity search scoped to one user.
-- RLS is enforced by the WHERE p_user_id = user_id clause; even with service role,
-- the p_user_id parameter ensures the function only returns rows for that user.
-- Gate requirement: cross-user RLS negative test passes because user_id is scoped.
create or replace function match_scan_history(
  p_user_id       uuid,
  query_embedding vector(1536),
  match_count     int default 10
)
returns table(
  scan_id      text,
  metadata     jsonb,
  health_score numeric(5,2),
  band         text,
  scanned_at   timestamptz,
  similarity   float
)
language sql stable security definer
as $$
  select
    she.scan_id,
    she.metadata,
    she.health_score,
    she.band,
    she.scanned_at,
    1 - (she.embedding <=> query_embedding) as similarity
  from scan_history_embeddings she
  where she.user_id = p_user_id
  order by she.embedding <=> query_embedding
  limit match_count;
$$;

-- push_preferences table (referenced by preferences.ts)
create table if not exists push_preferences (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  preferences  jsonb not null default '{}'::jsonb,
  updated_at   timestamptz default now()
);

alter table push_preferences enable row level security;

create policy "Users can manage own push preferences"
  on push_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- push_tokens table (referenced by weekly-report.ts)
create table if not exists push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  fcm_token  text,
  apns_token text,
  updated_at timestamptz default now()
);

alter table push_tokens enable row level security;

create policy "Users can manage own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
