-- ============================================================
-- Migration 001: Initiales Schema
-- ============================================================

-- Erweiterungen
create extension if not exists "pgcrypto";

-- ============================================================
-- Tabellen
-- ============================================================

-- Profile (wird automatisch nach Registrierung befüllt)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at  timestamptz not null default now()
);

-- Gruppen
create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  min_participants int  not null default 3,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- Gruppenmitglieder
create table public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  email       text not null,
  status      text not null default 'pending' check (status in ('pending', 'active')),
  invite_code text not null unique default encode(gen_random_bytes(12), 'hex'),
  invited_by  uuid references public.profiles(id) on delete set null,
  joined_at   timestamptz,
  unique (group_id, email)
);

-- Verfügbarkeit (global, kein group_id)
create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  status     text not null check (status in ('available', 'uncertain')),
  from_time  time,
  until_time time,
  unique (user_id, date)
);

-- Terminvorschläge
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  proposed_date    date not null,
  from_time        time,
  until_time       time,
  min_participants int  not null default 3,
  status           text not null default 'voting' check (status in ('voting', 'confirmed', 'expired')),
  proposed_by      uuid not null references public.profiles(id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- Abstimmungsantworten
create table public.event_responses (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  response   text not null default 'uncertain' check (response in ('accepted', 'declined', 'uncertain')),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Kalenderverbindungen (für v2, noch nicht genutzt)
create table public.calendar_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider      text not null check (provider in ('google', 'microsoft', 'apple')),
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  unique (user_id, provider)
);

-- ============================================================
-- Trigger: Auto-Profil nach Registrierung
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.groups             enable row level security;
alter table public.group_members      enable row level security;
alter table public.availability       enable row level security;
alter table public.events             enable row level security;
alter table public.event_responses    enable row level security;
alter table public.calendar_connections enable row level security;

-- profiles
create policy "Eigenes Profil lesen"   on public.profiles for select using (auth.uid() = id);
create policy "Eigenes Profil ändern"  on public.profiles for update using (auth.uid() = id);
create policy "Mitglieder-Profile lesen" on public.profiles for select
  using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm2.user_id = profiles.id
        and gm1.status = 'active'
        and gm2.status = 'active'
    )
  );

-- groups
create policy "Gruppe lesen wenn Mitglied" on public.groups for select
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and status = 'active'
  ));
create policy "Gruppe erstellen" on public.groups for insert
  with check (auth.uid() = created_by);
create policy "Gruppe ändern wenn Ersteller" on public.groups for update
  using (auth.uid() = created_by);
create policy "Gruppe löschen wenn Ersteller" on public.groups for delete
  using (auth.uid() = created_by);

-- group_members
create policy "Mitglieder lesen" on public.group_members for select
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.status = 'active'
  ) or user_id = auth.uid());
create policy "Mitglied einladen" on public.group_members for insert
  with check (exists (
    select 1 from public.groups where id = group_id and created_by = auth.uid()
  ));
create policy "Eigene Mitgliedschaft aktualisieren" on public.group_members for update
  using (user_id = auth.uid() or exists (
    select 1 from public.groups where id = group_id and created_by = auth.uid()
  ));

-- availability
create policy "Eigene Verfügbarkeit lesen" on public.availability for select
  using (auth.uid() = user_id);
create policy "Gruppen-Verfügbarkeit lesen" on public.availability for select
  using (exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
      and gm2.user_id = availability.user_id
      and gm1.status = 'active'
      and gm2.status = 'active'
  ));
create policy "Eigene Verfügbarkeit schreiben" on public.availability for insert
  with check (auth.uid() = user_id);
create policy "Eigene Verfügbarkeit ändern" on public.availability for update
  using (auth.uid() = user_id);
create policy "Eigene Verfügbarkeit löschen" on public.availability for delete
  using (auth.uid() = user_id);

-- events
create policy "Events lesen" on public.events for select
  using (exists (
    select 1 from public.group_members
    where group_id = events.group_id and user_id = auth.uid() and status = 'active'
  ));
create policy "Event vorschlagen" on public.events for insert
  with check (
    auth.uid() = proposed_by
    and exists (
      select 1 from public.group_members
      where group_id = events.group_id and user_id = auth.uid() and status = 'active'
    )
  );
create policy "Event ändern wenn Ersteller" on public.events for update
  using (auth.uid() = proposed_by);
create policy "Event löschen wenn Ersteller" on public.events for delete
  using (auth.uid() = proposed_by);

-- event_responses
create policy "Antworten lesen" on public.event_responses for select
  using (exists (
    select 1 from public.events e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = event_responses.event_id and gm.user_id = auth.uid() and gm.status = 'active'
  ));
create policy "Eigene Antwort schreiben" on public.event_responses for insert
  with check (auth.uid() = user_id);
create policy "Eigene Antwort ändern" on public.event_responses for update
  using (auth.uid() = user_id);

-- calendar_connections
create policy "Eigene Kalenderverbindung" on public.calendar_connections for all
  using (auth.uid() = user_id);
