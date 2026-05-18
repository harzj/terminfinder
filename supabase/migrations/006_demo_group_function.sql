-- ============================================================
-- Migration 006: Demo-Gruppe erstellen (für Tests ohne echte Nutzer)
-- ============================================================
-- Eine SECURITY DEFINER Funktion, die für den aktuell
-- authentifizierten Nutzer eine vollständige Demo-Gruppe
-- mit Beispiel-Terminen und Mitglieds-Einladungen anlegt.

create or replace function public.create_demo_group()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid;
  v_email     text;
  v_group_id  uuid;
  v_today     date;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;
  v_today := current_date;

  -- Demo-Gruppe anlegen
  insert into public.groups (name, description, min_participants, created_by)
  values (
    'Demo Gruppe 🎉',
    'Eine Testgruppe zum Ausprobieren der App. Lade Freunde ein und plant gemeinsame Termine!',
    3,
    v_uid
  )
  returning id into v_group_id;

  -- Ersteller als aktives Mitglied (Trigger macht es evtl. schon, on conflict sichert ab)
  insert into public.group_members (group_id, user_id, email, status, invited_by, joined_at)
  values (v_group_id, v_uid, coalesce(v_email, v_uid::text), 'active', v_uid, now())
  on conflict (group_id, email) do nothing;

  -- Simulierte eingeladene Personen (noch nicht registriert = pending)
  insert into public.group_members (group_id, email, status, invited_by)
  values
    (v_group_id, 'demo-max@beispiel.de',  'pending', v_uid),
    (v_group_id, 'demo-anna@beispiel.de', 'pending', v_uid),
    (v_group_id, 'demo-lena@beispiel.de', 'pending', v_uid);

  -- Zukünftige Terminvorschläge (abstimmend)
  insert into public.events (group_id, proposed_date, from_time, until_time, min_participants, status, proposed_by)
  values
    (v_group_id, v_today +  5, '18:00', '22:00', 3, 'voting', v_uid),
    (v_group_id, v_today + 12, '14:00', '18:00', 3, 'voting', v_uid),
    (v_group_id, v_today + 19, '19:00', '23:00', 3, 'voting', v_uid);

  -- Vergangene bestätigte Termine (für Archiv-Tab)
  insert into public.events (group_id, proposed_date, from_time, until_time, min_participants, status, proposed_by)
  values
    (v_group_id, v_today - 14, '18:00', '22:00', 3, 'confirmed', v_uid),
    (v_group_id, v_today - 30, '15:00', '19:00', 3, 'confirmed', v_uid);

  return v_group_id;
end;
$$;

-- Authentifizierte Nutzer dürfen die Funktion aufrufen
grant execute on function public.create_demo_group() to authenticated;
