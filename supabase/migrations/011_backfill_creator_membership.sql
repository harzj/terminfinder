-- Backfill: Gruppenersteller in group_members eintragen (mit Email aus auth.users)
-- Behebt den Fehler aus Migration 010 (email NOT NULL wurde nicht mitgegeben)

insert into public.group_members (group_id, user_id, email, status, invited_by, joined_at)
select
  g.id,
  g.created_by,
  u.email,
  'active',
  g.created_by,
  coalesce(g.created_at, now())
from public.groups g
join auth.users u on u.id = g.created_by
where not exists (
  select 1 from public.group_members gm
  where gm.group_id = g.id
    and gm.user_id = g.created_by
)
on conflict (group_id, email) do update
  set user_id   = excluded.user_id,
      status    = 'active',
      joined_at = coalesce(group_members.joined_at, excluded.joined_at);
