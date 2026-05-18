-- ============================================================
-- Migration 005: Robusterer Trigger + Backfill bestehender Gruppen
-- ============================================================
-- Problem: auth.users war im Trigger nicht erreichbar, Ersteller
-- wurde nicht als Mitglied eingetragen.
-- Fix: auth zu search_path hinzufügen + EXCEPTION-Handler + Backfill.

create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  begin
    select email into v_email from auth.users where id = new.created_by;
  exception when others then
    v_email := null;
  end;

  insert into public.group_members (group_id, user_id, email, status, invited_by, joined_at)
  values (
    new.id,
    new.created_by,
    coalesce(v_email, new.created_by::text),
    'active',
    new.created_by,
    now()
  )
  on conflict (group_id, email) do nothing;

  return new;
end;
$$;

-- Bestehende Gruppen nachfüllen (Ersteller, die noch nicht Mitglied sind)
do $$
declare
  g record;
  v_email text;
begin
  for g in select id, created_by, created_at from public.groups loop
    if not exists (
      select 1 from public.group_members
      where group_id = g.id and user_id = g.created_by
    ) then
      begin
        select email into v_email from auth.users where id = g.created_by;
      exception when others then
        v_email := null;
      end;

      insert into public.group_members (group_id, user_id, email, status, invited_by, joined_at)
      values (
        g.id,
        g.created_by,
        coalesce(v_email, g.created_by::text),
        'active',
        g.created_by,
        g.created_at
      )
      on conflict (group_id, email) do nothing;
    end if;
  end loop;
end;
$$;
