-- ============================================================
-- Migration 004: Auto-add group creator as active member
-- ============================================================
-- Trigger fires after INSERT on groups and adds the creator
-- as an active member. Runs as SECURITY DEFINER so no RLS issues.

create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, email, status, invited_by, joined_at)
  values (
    new.id,
    new.created_by,
    (select email from auth.users where id = new.created_by),
    'active',
    new.created_by,
    now()
  )
  on conflict (group_id, email) do nothing;
  return new;
end;
$$;

create or replace trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();
