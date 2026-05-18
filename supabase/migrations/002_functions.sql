-- ============================================================
-- Migration 002: DB-Funktionen & Trigger für Event-Logik
-- ============================================================

-- ============================================================
-- Funktion: Wenn jemand eine Event-Einladung bekommt → Antwort vorausfüllen
-- ============================================================
create or replace function public.prefill_event_responses()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  member record;
  avail_status text;
begin
  -- Für alle aktiven Mitglieder der Gruppe Antworten anlegen
  for member in
    select gm.user_id
    from public.group_members gm
    where gm.group_id = new.group_id
      and gm.status = 'active'
  loop
    -- Verfügbarkeit des Mitglieds an diesem Datum prüfen
    select a.status into avail_status
    from public.availability a
    where a.user_id = member.user_id
      and a.date = new.proposed_date;

    -- Kein Eintrag oder status fehlt → 'declined', sonst 'uncertain'
    insert into public.event_responses (event_id, user_id, response)
    values (
      new.id,
      member.user_id,
      case when avail_status is not null then 'uncertain' else 'declined' end
    )
    on conflict (event_id, user_id) do nothing;
  end loop;

  return new;
end;
$$;

create trigger on_event_created
  after insert on public.events
  for each row execute procedure public.prefill_event_responses();

-- ============================================================
-- Funktion: Wenn jemand 'accepted' → Bestätigung prüfen + Sperren
-- ============================================================
create or replace function public.handle_event_acceptance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  accepted_count int;
  required_count int;
  event_date     date;
  event_status   text;
begin
  -- Nur bei Änderung auf 'accepted' reagieren
  if new.response != 'accepted' or old.response = 'accepted' then
    return new;
  end if;

  -- Event-Infos holen
  select min_participants, proposed_date, status
    into required_count, event_date, event_status
  from public.events
  where id = new.event_id;

  -- Bereits bestätigt → nichts tun
  if event_status = 'confirmed' then
    return new;
  end if;

  -- Anzahl Zusagen zählen
  select count(*) into accepted_count
  from public.event_responses
  where event_id = new.event_id and response = 'accepted';

  -- Schwelle erreicht → Event bestätigen
  if accepted_count >= required_count then
    update public.events
    set status = 'confirmed'
    where id = new.event_id;

    -- Alle anderen Events dieses Users am gleichen Tag auf 'declined' setzen
    update public.event_responses er
    set response = 'declined',
        updated_at = now()
    from public.events e
    where er.event_id = e.id
      and er.user_id = new.user_id
      and er.event_id != new.event_id
      and e.proposed_date = event_date
      and e.status = 'voting';
  end if;

  -- Wenn der User selbst in anderen Events am gleichen Tag war
  -- und jetzt hier bestätigt hat → dort auf 'declined'
  update public.event_responses er
  set response = 'declined',
      updated_at = now()
  from public.events e
  where er.event_id = e.id
    and er.user_id = new.user_id
    and er.event_id != new.event_id
    and e.proposed_date = event_date;

  return new;
end;
$$;

create trigger on_event_response_accepted
  after update on public.event_responses
  for each row execute procedure public.handle_event_acceptance();

-- ============================================================
-- Funktion: Abgelaufene Events bereinigen (täglich via CRON)
-- ============================================================
create or replace function public.expire_past_events()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.events
  set status = 'expired'
  where proposed_date < current_date
    and status = 'voting';
end;
$$;

-- CRON-Job: täglich um 1:00 Uhr abgelaufene Events markieren
-- (pg_cron muss in Supabase unter Database → Extensions aktiviert sein)
-- select cron.schedule('expire-events', '0 1 * * *', 'select public.expire_past_events()');
