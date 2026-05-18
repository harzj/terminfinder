-- ============================================================
-- Migration 003: Fix RLS infinite recursion in group_members
-- ============================================================
-- Problem: The group_members SELECT policy referenced group_members itself,
-- causing infinite recursion (42P17). All policies querying group_members
-- from other tables triggered the same loop.
-- Fix: Use a SECURITY DEFINER helper function that bypasses RLS.

-- Helper function: returns group IDs where the given user is an active member.
-- SECURITY DEFINER bypasses RLS so there is no recursive policy check.
create or replace function public.get_active_group_ids(uid uuid)
returns uuid[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(group_id), '{}')
  from public.group_members
  where user_id = uid and status = 'active'
$$;

-- ── group_members ────────────────────────────────────────────
drop policy if exists "Mitglieder lesen" on public.group_members;
create policy "Mitglieder lesen" on public.group_members for select
  using (
    group_id = any(public.get_active_group_ids(auth.uid()))
    or user_id = auth.uid()
  );

-- ── groups ───────────────────────────────────────────────────
drop policy if exists "Gruppe lesen wenn Mitglied" on public.groups;
create policy "Gruppe lesen wenn Mitglied" on public.groups for select
  using (
    created_by = auth.uid()
    or id = any(public.get_active_group_ids(auth.uid()))
  );

-- ── profiles ─────────────────────────────────────────────────
drop policy if exists "Mitglieder-Profile lesen" on public.profiles;
create policy "Mitglieder-Profile lesen" on public.profiles for select
  using (
    id in (
      select gm.user_id from public.group_members gm
      where gm.group_id = any(public.get_active_group_ids(auth.uid()))
        and gm.status = 'active'
    )
  );

-- ── availability ─────────────────────────────────────────────
drop policy if exists "Gruppen-Verfügbarkeit lesen" on public.availability;
create policy "Gruppen-Verfügbarkeit lesen" on public.availability for select
  using (
    user_id in (
      select gm.user_id from public.group_members gm
      where gm.group_id = any(public.get_active_group_ids(auth.uid()))
        and gm.status = 'active'
    )
  );

-- ── events ───────────────────────────────────────────────────
drop policy if exists "Events lesen" on public.events;
create policy "Events lesen" on public.events for select
  using (group_id = any(public.get_active_group_ids(auth.uid())));

drop policy if exists "Event vorschlagen" on public.events;
create policy "Event vorschlagen" on public.events for insert
  with check (
    auth.uid() = proposed_by
    and group_id = any(public.get_active_group_ids(auth.uid()))
  );

-- ── event_responses ──────────────────────────────────────────
drop policy if exists "Antworten lesen" on public.event_responses;
create policy "Antworten lesen" on public.event_responses for select
  using (
    event_id in (
      select e.id from public.events e
      where e.group_id = any(public.get_active_group_ids(auth.uid()))
    )
  );
