-- Fix: Gruppenersteller können group_members lesen, auch wenn sie keinen
-- eigenen group_members-Eintrag haben (edge case bei alten Accounts).

-- Alten Policy droppen
drop policy if exists "Mitglieder lesen" on public.group_members;

-- Neue Policy: eigener Eintrag ODER aktives Mitglied ODER Ersteller der Gruppe
create policy "Mitglieder lesen" on public.group_members
  for select using (
    user_id = auth.uid()
    or group_id = any(public.get_active_group_ids(auth.uid()))
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id
        and g.created_by = auth.uid()
    )
  );

-- Backfill: Sicherstellen, dass alle Gruppenersteller auch in group_members sind
insert into public.group_members (group_id, user_id, status, joined_at)
select g.id, g.created_by, 'active', coalesce(g.created_at, now())
from public.groups g
where g.created_by is not null
  and not exists (
    select 1 from public.group_members gm
    where gm.group_id = g.id
      and gm.user_id = g.created_by
  )
on conflict (group_id, user_id) do nothing;
