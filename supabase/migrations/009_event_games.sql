-- ============================================================
-- Migration 009: Gespielte Spiele pro Spieleabend (BGG-Integration)
-- ============================================================

create table public.event_games (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  bgg_id        integer not null,
  name          text not null,
  thumbnail_url text,
  added_by      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.event_games enable row level security;

-- SELECT: aktive Mitglieder der Gruppe des Events
create policy "Gespielte Spiele lesen" on public.event_games
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_games.event_id
        and e.group_id = any(public.get_active_group_ids(auth.uid()))
    )
  );

-- INSERT: aktive Mitglieder der Gruppe
create policy "Gespielte Spiele eintragen" on public.event_games
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_games.event_id
        and e.group_id = any(public.get_active_group_ids(auth.uid()))
    )
  );

-- DELETE: aktive Mitglieder der Gruppe dürfen löschen
create policy "Gespielte Spiele löschen" on public.event_games
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_games.event_id
        and e.group_id = any(public.get_active_group_ids(auth.uid()))
    )
  );
