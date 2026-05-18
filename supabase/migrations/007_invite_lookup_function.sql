-- ============================================================
-- Migration 007: Öffentliche Invite-Lookup Funktion
-- ============================================================
-- Problem: Anonyme Nutzer können group_members nicht lesen (RLS),
-- daher schlägt der Einladungslink mit 404 fehl.
-- Fix: SECURITY DEFINER Funktion, die einen Invite-Datensatz
-- anhand des geheimen invite_code zurückgibt (Code = Token).

create or replace function public.get_invite_info(p_code text)
returns table(
  member_id    uuid,
  group_id     uuid,
  member_email text,
  member_status text,
  group_name   text,
  group_description text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    gm.id,
    gm.group_id,
    gm.email,
    gm.status,
    g.name,
    g.description
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.invite_code = p_code
  limit 1;
$$;

-- Anon-Nutzer (nicht eingeloggt) und eingeloggte Nutzer dürfen aufrufen
grant execute on function public.get_invite_info(text) to anon, authenticated;
