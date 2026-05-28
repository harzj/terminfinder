-- Migration 022: Allow users to leave a group + creator can remove members

-- Nutzer darf eigene Mitgliedschaft löschen (Gruppe verlassen)
create policy "Eigene Mitgliedschaft verlassen" on public.group_members
  for delete
  using (user_id = auth.uid());

-- Gruppen-Ersteller darf beliebige Mitglieder entfernen
create policy "Ersteller kann Mitglieder entfernen" on public.group_members
  for delete
  using (
    exists (
      select 1 from public.groups
      where id = group_members.group_id
        and created_by = auth.uid()
    )
  );
