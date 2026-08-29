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
-- Stanze online.
-- La partita viaggia sui canali realtime; queste tabelle conservano l'ultimo
-- stato salvato dall'host, così chi ricarica o rientra ritrova la stanza.
-- ---------------------------------------------------------------------------

create table if not exists public.games (
  code text primary key,
  host_id text not null,
  phase text not null default 'lobby',
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Chi ha il codice può leggere e aggiornare la propria stanza: nessun dato
-- personale ci transita, solo lo stato della partita in corso.
drop policy if exists "games_public_read" on public.games;
create policy "games_public_read" on public.games for select using (true);

drop policy if exists "games_public_insert" on public.games;
create policy "games_public_insert"
  on public.games for insert
  with check (char_length(code) between 4 and 8);

drop policy if exists "games_public_update" on public.games;
create policy "games_public_update"
  on public.games for update
  using (true)
  with check (char_length(code) between 4 and 8);

create table if not exists public.game_players (
  code text not null references public.games on delete cascade,
  player_id text not null,
  name text not null,
  emoji text not null default 'flame',
  joined_at timestamptz not null default now(),
  primary key (code, player_id)
);

alter table public.game_players enable row level security;

drop policy if exists "game_players_public_read" on public.game_players;
create policy "game_players_public_read" on public.game_players for select using (true);

drop policy if exists "game_players_public_insert" on public.game_players;
create policy "game_players_public_insert"
  on public.game_players for insert
  with check (char_length(name) between 1 and 32);

drop policy if exists "game_players_public_delete" on public.game_players;
create policy "game_players_public_delete"
  on public.game_players for delete
  using (true);

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
  -- Nickname pubblico e unico: solo minuscole, cifre e underscore, così
  -- "Marco" e "marco" non possono coesistere.
  nickname text not null unique check (nickname ~ '^[a-z0-9_]{3,20}$'),
  emoji text not null default 'flame',
  created_at timestamptz not null default now()
);

-- Allineamento per chi aveva già creato la tabella.
alter table public.profiles alter column emoji set default 'flame';

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
-- Pickmates: la rubrica degli amici con cui si gioca.
-- Sostituisce "friendships", di cui riprende i dati se la tabella esisteva già.
-- ---------------------------------------------------------------------------

create table if not exists public.pickmates (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  -- Nessuno può essere Pickmate di sé stesso.
  check (user_id <> friend_id)
);

alter table public.pickmates enable row level security;

drop policy if exists "pickmates_own_read" on public.pickmates;
create policy "pickmates_own_read"
  on public.pickmates for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Si invita solo a proprio nome.
drop policy if exists "pickmates_own_write" on public.pickmates;
create policy "pickmates_own_write"
  on public.pickmates for insert
  with check (auth.uid() = user_id);

-- Accetta chi ha ricevuto l'invito.
drop policy if exists "pickmates_own_update" on public.pickmates;
create policy "pickmates_own_update"
  on public.pickmates for update
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "pickmates_own_delete" on public.pickmates;
create policy "pickmates_own_delete"
  on public.pickmates for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Travaso una tantum dalla vecchia tabella.
do $$
begin
  if to_regclass('public.friendships') is not null then
    insert into public.pickmates (user_id, friend_id, status, created_at)
    select user_id, friend_id, status, created_at from public.friendships
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Avversari recenti: chi si è incontrato nelle ultime partite e quante volte.
-- Ognuno scrive solo le proprie righe, quindi il conteggio è il proprio.
-- ---------------------------------------------------------------------------

create table if not exists public.recent_opponents (
  user_id uuid not null references public.profiles on delete cascade,
  opponent_id uuid not null references public.profiles on delete cascade,
  played_count integer not null default 1,
  last_played_at timestamptz not null default now(),
  primary key (user_id, opponent_id),
  check (user_id <> opponent_id)
);

alter table public.recent_opponents enable row level security;

drop policy if exists "recent_opponents_own_read" on public.recent_opponents;
create policy "recent_opponents_own_read"
  on public.recent_opponents for select
  using (auth.uid() = user_id or auth.uid() = opponent_id);

drop policy if exists "recent_opponents_own_write" on public.recent_opponents;
create policy "recent_opponents_own_write"
  on public.recent_opponents for insert
  with check (auth.uid() = user_id);

drop policy if exists "recent_opponents_own_update" on public.recent_opponents;
create policy "recent_opponents_own_update"
  on public.recent_opponents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Registra una partita giocata insieme, sommando al conteggio esistente.
create or replace function public.bump_recent_opponent(opponent uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.recent_opponents (user_id, opponent_id, played_count, last_played_at)
  select auth.uid(), opponent, 1, now()
  where auth.uid() is not null and auth.uid() <> opponent
  on conflict (user_id, opponent_id) do update
    set played_count = recent_opponents.played_count + 1,
        last_played_at = now();
$$;

grant execute on function public.bump_recent_opponent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Email di ricerca.
-- L'email sta in una tabella a parte, leggibile solo dal proprietario: la
-- ricerca passa da una funzione che accetta solo la corrispondenza esatta, così
-- nessuno può scorrere l'elenco degli indirizzi.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_emails (
  user_id uuid primary key references public.profiles on delete cascade,
  email text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.profile_emails enable row level security;

drop policy if exists "profile_emails_self_read" on public.profile_emails;
create policy "profile_emails_self_read"
  on public.profile_emails for select
  using (auth.uid() = user_id);

drop policy if exists "profile_emails_self_write" on public.profile_emails;
create policy "profile_emails_self_write"
  on public.profile_emails for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_emails_self_update" on public.profile_emails;
create policy "profile_emails_self_update"
  on public.profile_emails for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.find_pickmate_by_email(target_email text)
returns table (id uuid, nickname text, emoji text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.nickname, p.emoji
  from public.profile_emails e
  join public.profiles p on p.id = e.user_id
  where lower(e.email) = lower(btrim(target_email))
  limit 1;
$$;

grant execute on function public.find_pickmate_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sfide: un invito a entrare in una stanza, con una battuta a sorte.
-- ---------------------------------------------------------------------------

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  code text not null check (char_length(code) between 4 and 8),
  taunt smallint not null default 1 check (taunt between 1 and 8),
  status text not null default 'sent' check (status in ('sent', 'joined', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists challenges_to_user_idx on public.challenges (to_user, created_at desc);

alter table public.challenges enable row level security;

drop policy if exists "challenges_own_read" on public.challenges;
create policy "challenges_own_read"
  on public.challenges for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "challenges_own_insert" on public.challenges;
create policy "challenges_own_insert"
  on public.challenges for insert
  with check (auth.uid() = from_user);

-- Chi la riceve la segna come accettata o ignorata.
drop policy if exists "challenges_own_update" on public.challenges;
create policy "challenges_own_update"
  on public.challenges for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);

-- Le notifiche arrivano dal vivo: entrambe le tabelle vanno pubblicate.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pickmates;
    alter publication supabase_realtime add table public.challenges;
  end if;
exception
  when duplicate_object then null;
end $$;

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
