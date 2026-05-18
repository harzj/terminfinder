-- ============================================================
-- Migration 008: Accept-Invite Funktion
-- ============================================================
-- Problem: UPDATE-Policy auf group_members prüft user_id = auth.uid(),
-- aber pending-Einladungen haben user_id = null → Update schlägt still fehl.
-- Fix: SECURITY DEFINER Funktion, die den Invite sicher annimmt.

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid        uuid;
  v_email      text;
  v_group_id   uuid;
  v_is_general boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Prüfen ob allgemeiner Link (__link__) oder email-spezifischer Invite
  select
    group_id,
    (email = '__link__') as is_general
  into v_group_id, v_is_general
  from public.group_members
  where invite_code = p_code
  limit 1;

  if v_group_id is null then
    return null; -- ungültiger Code
  end if;

  if v_is_general then
    -- Allgemeiner Link: neuen Mitgliedseintrag anlegen, __link__-Zeile unangetastet lassen
    insert into public.group_members (group_id, user_id, email, status, joined_at)
    values (v_group_id, v_uid, coalesce(v_email, v_uid::text), 'active', now())
    on conflict (group_id, email) do update
      set user_id = v_uid, status = 'active', joined_at = now();
  else
    -- Email-spezifischer Invite: pending-Zeile übernehmen
    update public.group_members
    set
      user_id   = v_uid,
      email     = coalesce(v_email, v_uid::text),
      status    = 'active',
      joined_at = now()
    where invite_code = p_code
      and status = 'pending';
  end if;

  return v_group_id;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;
