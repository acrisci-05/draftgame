-- Tabella delle categorie condivise tramite link univoco.
-- Esegui questo script nell'SQL editor del progetto Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🔥',
  items jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Chiunque abbia il link può leggere la categoria.
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
  on public.categories for select
  using (true);

-- Pubblicazione aperta dal client con la chiave anon.
drop policy if exists "categories_public_insert" on public.categories;
create policy "categories_public_insert"
  on public.categories for insert
  with check (
    char_length(name) between 1 and 60
    and jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) <= 60
  );

-- Aggiornamento consentito per ripubblicare una categoria dallo stesso link.
drop policy if exists "categories_public_update" on public.categories;
create policy "categories_public_update"
  on public.categories for update
  using (true)
  with check (jsonb_typeof(items) = 'array');

-- Suggerimenti anonimi inviati dal menu: si scrivono soltanto, non si rileggono dal client.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  idea text not null default '',
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;

drop policy if exists "suggestions_public_insert" on public.suggestions;
create policy "suggestions_public_insert"
  on public.suggestions for insert
  with check (
    char_length(name) between 1 and 60
    and char_length(idea) <= 1000
  );

-- Roster di fine partita pubblicati per la votazione.
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  category_name text not null,
  category_emoji text not null default '🔥',
  currency text not null default 'EUR',
  players jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.results enable row level security;

drop policy if exists "results_public_read" on public.results;
create policy "results_public_read"
  on public.results for select
  using (true);

drop policy if exists "results_public_insert" on public.results;
create policy "results_public_insert"
  on public.results for insert
  with check (
    char_length(code) between 1 and 8
    and jsonb_typeof(players) = 'array'
    and jsonb_array_length(players) <= 8
  );

-- Un voto per dispositivo: la chiave primaria impedisce i doppioni.
create table if not exists public.votes (
  result_id uuid not null references public.results(id) on delete cascade,
  player_id text not null,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (result_id, voter_key)
);

alter table public.votes enable row level security;

drop policy if exists "votes_public_read" on public.votes;
create policy "votes_public_read"
  on public.votes for select
  using (true);

drop policy if exists "votes_public_insert" on public.votes;
create policy "votes_public_insert"
  on public.votes for insert
  with check (char_length(player_id) between 1 and 64);

-- L'upsert riscrive il voto quando lo stesso dispositivo cambia idea.
drop policy if exists "votes_public_update" on public.votes;
create policy "votes_public_update"
  on public.votes for update
  using (true)
  with check (char_length(player_id) between 1 and 64);

-- Le stanze di gioco viaggiano sui Realtime Channels (broadcast + presence)
-- e non richiedono tabelle dedicate.
