-- Migration 022: Allow users to leave a group (delete own membership)

create policy "Eigene Mitgliedschaft verlassen" on public.group_members
  for delete
  using (user_id = auth.uid());
