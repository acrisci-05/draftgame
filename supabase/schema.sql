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

-- Accetta solo chi ha ricevuto l'invito.
-- Prima la regola valeva per entrambi: chi invitava poteva segnare da solo la
-- propria richiesta come accettata, e comparire in rubrica senza il consenso
-- dell'altro. L'aggiornamento adesso e' riservato al destinatario; per sciogliere
-- l'amicizia restano buone le regole di cancellazione, valide per tutti e due.
drop policy if exists "pickmates_own_update" on public.pickmates;
drop policy if exists "pickmates_accept_incoming" on public.pickmates;
create policy "pickmates_accept_incoming"
  on public.pickmates for update
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

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

-- ---------------------------------------------------------------------------
-- Storico delle partite.
-- Una riga per giocatore per partita, scritta da chi l'ha giocata. Serve alle
-- statistiche del profilo: quante partite, quante vinte, quanto si e' speso.
-- Ognuno vede e scrive solo le proprie righe: nessuno puo' leggere lo storico
-- di un altro, e nessuno puo' gonfiare il proprio scrivendo a nome altrui.
-- ---------------------------------------------------------------------------

create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  code text not null,
  category text not null,
  players integer not null check (players between 1 and 8),
  position integer not null check (position >= 1),
  spent integer not null check (spent >= 0),
  items integer not null check (items >= 0),
  currency text not null default 'EUR',
  played_at timestamptz not null default now(),
  -- La stessa partita non si conta due volte, anche se la pagina viene
  -- ricaricata o il risultato arriva da piu' dispositivi.
  unique (user_id, code, played_at)
);

create index if not exists match_history_user_idx
  on public.match_history (user_id, played_at desc);

alter table public.match_history enable row level security;

drop policy if exists "match_history_own_read" on public.match_history;
create policy "match_history_own_read"
  on public.match_history for select
  using (auth.uid() = user_id);

drop policy if exists "match_history_own_insert" on public.match_history;
create policy "match_history_own_insert"
  on public.match_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "match_history_own_delete" on public.match_history;
create policy "match_history_own_delete"
  on public.match_history for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Suggerimenti: chi li legge e chi li gestisce.
--
-- Finora la tabella aveva solo il permesso di scrittura: chiunque poteva
-- mandare un'idea, nessuno poteva rileggerla dal sito, nemmeno il creatore.
-- L'unica porta era il pannello Supabase.
--
-- Qui si aggiunge il contrassegno di creatore sul profilo e si aprono lettura,
-- aggiornamento e cancellazione dei suggerimenti a chi ce l'ha. Il controllo
-- vive nel database, non nell'interfaccia: la chiave dello Studio nasconde i
-- pulsanti, questa regola difende i dati. Chi provasse a chiedere la tabella
-- con la chiave pubblica continua a ricevere una lista vuota.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Quando il suggerimento è stato letto e sistemato. Nullo = ancora da vedere.
alter table public.suggestions
  add column if not exists handled_at timestamptz;

create index if not exists suggestions_recent_idx
  on public.suggestions (created_at desc);

-- Vero solo per chi ha il contrassegno di creatore sul proprio profilo.
-- Resta a diritti di chi chiama: i profili sono già leggibili da tutti, quindi
-- non serve (e non si vuole) alzare i privilegi.
create or replace function public.is_creator() returns boolean
  language sql
  stable
  as $$
    select exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin
    )
  $$;

drop policy if exists "suggestions_creator_read" on public.suggestions;
create policy "suggestions_creator_read"
  on public.suggestions for select
  to authenticated
  using (public.is_creator());

drop policy if exists "suggestions_creator_update" on public.suggestions;
create policy "suggestions_creator_update"
  on public.suggestions for update
  to authenticated
  using (public.is_creator())
  with check (public.is_creator());

drop policy if exists "suggestions_creator_delete" on public.suggestions;
create policy "suggestions_creator_delete"
  on public.suggestions for delete
  to authenticated
  using (public.is_creator());

-- Il creatore. Cambia il nickname se un giorno usi un altro profilo.
update public.profiles set is_admin = true where nickname = 'crispy';

-- ---------------------------------------------------------------------------
-- Stato di attività dei PickMates.
--
-- Ogni riga dice se quella persona sta guardando il sito o sta giocando, e da
-- quanto. Non si conserva uno storico: c'è una riga per persona che viene
-- riscritta, quindi non si può ricostruire a posteriori quando qualcuno era
-- collegato.
--
-- La regola della reciprocità vive qui e non nell'interfaccia: chi spegne il
-- proprio stato non riesce a leggere quello degli altri nemmeno aggirando la
-- pagina, perché è la lettura stessa a richiedere che il lettore sia visibile.
-- Nascondersi e continuare a guardare non è una cosa che il database consenta.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists shows_presence boolean not null default true;

create table if not exists public.presence (
  user_id uuid primary key references public.profiles on delete cascade,
  -- "online" = sito aperto, "playing" = dentro una partita.
  state text not null default 'online' check (state in ('online', 'playing')),
  updated_at timestamptz not null default now()
);

alter table public.presence enable row level security;

-- Ognuno scrive solo la propria riga.
drop policy if exists "presence_self_write" on public.presence;
create policy "presence_self_write"
  on public.presence for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "presence_self_update" on public.presence;
create policy "presence_self_update"
  on public.presence for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "presence_self_delete" on public.presence;
create policy "presence_self_delete"
  on public.presence for delete
  to authenticated
  using (auth.uid() = user_id);

-- Le due funzioni di appoggio stanno in uno schema separato, non in "public".
--
-- Il motivo e' che scavalcano le protezioni (security definer: devono poter
-- guardare amicizie e profili altrui per rispondere) e tutto quello che sta in
-- "public" viene pubblicato come indirizzo interrogabile dall'esterno. Lasciate
-- li', chiunque avrebbe potuto prendere gli id dei profili -- che sono pubblici
-- -- e chiedere coppia per coppia "questi due sono amici?", ricostruendo la
-- rete di amicizie che la tabella pickmates si rifiuta di consegnare.
--
-- In uno schema non pubblicato restano usabili dalle regole di accesso, che
-- girano dentro il database, e irraggiungibili da fuori.
create schema if not exists private;

-- Vero se le due persone sono PickMates accettati, in un verso o nell'altro.
create or replace function private.are_pickmates(a uuid, b uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select exists (
      select 1 from public.pickmates
      where status = 'accepted'
        and ((user_id = a and friend_id = b) or (user_id = b and friend_id = a))
    )
  $$;

-- Vero se quella persona ha lasciato acceso il proprio stato.
create or replace function private.shows_presence(who uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select coalesce((select shows_presence from public.profiles where id = who), false)
  $$;

-- Nessuno le puo' chiamare, tranne chi ha fatto l'accesso, e solo perche' le
-- regole di lettura le richiamano per suo conto.
revoke execute on function private.are_pickmates(uuid, uuid) from public;
revoke execute on function private.shows_presence(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.are_pickmates(uuid, uuid) to authenticated;
grant execute on function private.shows_presence(uuid) to authenticated;

-- Si legge lo stato di un PickMate solo se lui lo mostra e se lo mostri anche tu.
drop policy if exists "presence_mates_read" on public.presence;
create policy "presence_mates_read"
  on public.presence for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      private.shows_presence(auth.uid())
      and private.shows_presence(user_id)
      and private.are_pickmates(auth.uid(), user_id)
    )
  );

-- Via le versioni pubbliche, che erano interrogabili da chiunque.
drop function if exists public.are_pickmates(uuid, uuid);
drop function if exists public.shows_presence(uuid);

-- ---------------------------------------------------------------------------
-- Esperienza e livelli.
--
-- Due accorgimenti, perche' i punti li chiede il dispositivo di chi gioca e
-- non c'e' un arbitro sul server che possa smentirlo:
--
-- 1. Le colonne dell'esperienza non sono scrivibili da nessuno. Il permesso di
--    modifica sui profili viene tolto e ridato solo su nickname, avatar e
--    stato di attivita': una richiesta che provasse a scrivere xp direttamente
--    viene rifiutata dal database, non dall'app.
--
-- 2. Una partita paga una volta sola. Ogni premio lascia una riga con il
--    codice della stanza: richiamare la stessa partita cento volte non da'
--    cento volte i punti. E' la difesa che conta davvero, perche' senza di
--    essa bastava ripetere la stessa chiamata.
--
-- Resta possibile, a chi sa mettere le mani nel traffico, dichiarare una
-- vittoria che non c'e' stata. Non e' aggirabile senza spostare tutta la
-- partita sul server: i premi sono solo estetici anche per questo.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists xp integer not null default 0 check (xp >= 0);
-- Nessuna colonna "livello": il livello e' una funzione dell'esperienza, e
-- tenerne due copie vuol dire che prima o poi si contraddicono. Si calcola
-- dove serve, da lib/levels.ts, che e' l'unico posto dove sono scritte le
-- soglie ed e' coperto dai test.
alter table public.profiles
  add column if not exists equipped_title text;
alter table public.profiles
  add column if not exists last_social_bonus_date date;

-- Le colonne che una persona puo' cambiare di suo pugno. Tutto il resto del
-- profilo -- esperienza, livello, contrassegno di creatore -- resta fuori.
revoke update on public.profiles from authenticated;
grant update (nickname, emoji, shows_presence, equipped_title) on public.profiles to authenticated;

-- Una riga per ogni partita gia' pagata.
create table if not exists public.xp_awards (
  user_id uuid not null references public.profiles on delete cascade,
  code text not null,
  amount integer not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.xp_awards enable row level security;

drop policy if exists "xp_awards_own_read" on public.xp_awards;
create policy "xp_awards_own_read"
  on public.xp_awards for select
  to authenticated
  using (auth.uid() = user_id);

-- Assegna l'esperienza di una partita e restituisce quanta ne ha data.
-- Zero significa "questa partita era gia' stata pagata".
create or replace function public.award_match_xp(
  match_code text,
  won boolean,
  votes integer,
  with_mate boolean
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  oggi date := (now() at time zone 'utc')::date;
  bonus_gia_preso date;
  punti integer;
  sociale integer := 0;
begin
  if me is null then
    return 0;
  end if;

  -- I tetti si applicano qui, non nell'app: e' l'unico punto che non si
  -- puo' scavalcare cambiando il codice della pagina.
  punti := 50
    + (case when won then 100 else 0 end)
    + least(greatest(coalesce(votes, 0), 0) * 10, 100);

  select last_social_bonus_date into bonus_gia_preso
  from public.profiles where id = me;

  if coalesce(with_mate, false)
     and (bonus_gia_preso is null or bonus_gia_preso < oggi) then
    sociale := 100;
  end if;

  -- La chiave doppia rifiuta la seconda richiesta sulla stessa partita.
  begin
    insert into public.xp_awards (user_id, code, amount)
    values (me, upper(btrim(match_code)), punti + sociale);
  exception when unique_violation then
    return 0;
  end;

  update public.profiles
  set xp = xp + punti + sociale,
      last_social_bonus_date = case when sociale > 0 then oggi else last_social_bonus_date end
  where id = me;

  return punti + sociale;
end;
$$;

revoke execute on function public.award_match_xp(text, boolean, integer, boolean) from public;
grant execute on function public.award_match_xp(text, boolean, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Il nickname si cambia una volta al mese.
--
-- Serve perche' il nickname e' l'indirizzo con cui gli amici ti trovano e la
-- firma che resta sulle card gia' condivise: se cambiasse ogni giorno, chi ti
-- ha aggiunto la settimana scorsa non saprebbe piu' chi sei, e una card di un
-- mese fa attribuirebbe la rosa a un nome che nel frattempo e' di un altro.
--
-- Il conto lo tiene il database e non l'app: il freno si mette dove non si puo'
-- aggirare cambiando la pagina.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists nickname_changed_at timestamptz;

create or replace function public.rename_profile(new_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  pulito text := lower(btrim(new_nickname));
  ultimo timestamptz;
  attuale text;
begin
  if me is null then
    return 'not-signed-in';
  end if;
  if pulito !~ '^[a-z0-9_]{3,20}$' then
    return 'invalid';
  end if;

  select nickname, nickname_changed_at into attuale, ultimo
  from public.profiles where id = me;

  if attuale = pulito then
    return 'ok';
  end if;

  -- Trenta giorni dall'ultimo cambio. Il primo e' sempre concesso: chi non ha
  -- mai cambiato ha la colonna vuota.
  if ultimo is not null and ultimo > now() - interval '30 days' then
    return 'too-soon';
  end if;

  if exists (select 1 from public.profiles where nickname = pulito) then
    return 'taken';
  end if;

  update public.profiles
  set nickname = pulito, nickname_changed_at = now()
  where id = me;

  return 'ok';
end;
$$;

revoke execute on function public.rename_profile(text) from public;
grant execute on function public.rename_profile(text) to authenticated;

-- Il nickname passa da qui: la colonna non e' piu' modificabile a mano.
revoke update on public.profiles from authenticated;
grant update (emoji, shows_presence, equipped_title) on public.profiles to authenticated;
