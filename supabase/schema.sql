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

-- Le stanze di gioco viaggiano sui Realtime Channels (broadcast + presence)
-- e non richiedono tabelle dedicate.
