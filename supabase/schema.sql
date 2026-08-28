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

-- ---------------------------------------------------------------------------
-- Voto del gioco: da 1 a 5 stelle, anonimo, un voto per dispositivo.
-- ---------------------------------------------------------------------------

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  voter_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Si può votare e correggere il proprio voto, ma non leggere quelli altrui:
-- i commenti restano visibili solo al creatore dalla console Supabase.
drop policy if exists "feedback_public_insert" on public.feedback;
create policy "feedback_public_insert"
  on public.feedback for insert
  with check (char_length(voter_key) between 1 and 64 and char_length(coalesce(comment, '')) <= 1000);

drop policy if exists "feedback_public_update" on public.feedback;
create policy "feedback_public_update"
  on public.feedback for update
  using (true)
  with check (char_length(coalesce(comment, '')) <= 1000);

-- Vista pubblica: espone solo media e numero di voti, mai i commenti.
create or replace view public.ratings_summary as
select
  coalesce(round(avg(stars)::numeric, 2), 0) as average,
  count(*)::int as count
from public.feedback;

grant select on public.ratings_summary to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Liste ufficiali gestite dal creatore.
-- Lettura per tutti, scrittura solo dall'SQL editor o con la service key:
-- l'app non ha alcun modo di inserire liste ufficiali.
-- ---------------------------------------------------------------------------

create table if not exists public.official_lists (
  id text primary key,
  name text not null,
  name_en text,
  emoji text not null default '🔥',
  theme text,
  tiers jsonb not null,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.official_lists enable row level security;

drop policy if exists "official_lists_public_read" on public.official_lists;
create policy "official_lists_public_read"
  on public.official_lists for select
  using (published);

-- ---------------------------------------------------------------------------
-- Predisposizione per la sezione amici "Pickpockets".
-- Le tabelle esistono ma restano inutilizzate finché non si attiva Supabase Auth:
-- l'interfaccia (registrazione, inviti, lista amici) è il passo successivo.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null unique check (char_length(nickname) between 3 and 20),
  emoji text not null default '🔥',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);

drop policy if exists "profiles_self_write" on public.profiles;
create policy "profiles_self_write"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.friendships enable row level security;

drop policy if exists "friendships_own_read" on public.friendships;
create policy "friendships_own_read"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "friendships_own_write" on public.friendships;
create policy "friendships_own_write"
  on public.friendships for insert
  with check (auth.uid() = user_id);

drop policy if exists "friendships_own_update" on public.friendships;
create policy "friendships_own_update"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "friendships_own_delete" on public.friendships;
create policy "friendships_own_delete"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Draft mandati agli amici perché li votino.
create table if not exists public.shared_results (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results on delete cascade,
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (result_id, to_user)
);

alter table public.shared_results enable row level security;

drop policy if exists "shared_results_own_read" on public.shared_results;
create policy "shared_results_own_read"
  on public.shared_results for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "shared_results_own_insert" on public.shared_results;
create policy "shared_results_own_insert"
  on public.shared_results for insert
  with check (auth.uid() = from_user);

drop policy if exists "shared_results_own_update" on public.shared_results;
create policy "shared_results_own_update"
  on public.shared_results for update
  using (auth.uid() = from_user)
  with check (auth.uid() = from_user);

-- ---------------------------------------------------------------------------
-- I suggerimenti di categoria arrivano solo da chi ha fatto l'accesso.
-- ---------------------------------------------------------------------------

alter table public.suggestions
  add column if not exists author uuid references public.profiles on delete set null;

drop policy if exists "suggestions_public_insert" on public.suggestions;
drop policy if exists "suggestions_signed_insert" on public.suggestions;
create policy "suggestions_signed_insert"
  on public.suggestions for insert
  to authenticated
  with check (
    auth.uid() is not null
    and char_length(name) between 1 and 60
    and char_length(idea) <= 1000
  );
