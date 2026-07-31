import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GruppenDetailClient from './GruppenDetailClient'
import { clampPlanningMonths, getPlanningRangeFromMonday, toLocalDateString } from '@/lib/planningWindow'
import { parseISO } from 'date-fns'
import { computeOverlaps } from '@/lib/overlap'

export default async function GruppenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  // Gruppe laden + Mitgliedschaft prüfen
  const { data: membership } = await supabase
    .from('group_members')
    .select('status')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.status !== 'active') notFound()

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single()

  if (!group) notFound()

  // Mitglieder laden (getrennte Queries wegen RLS + nested join Problem)
  const { data: rawMembers } = await supabase
    .from('group_members')
    .select('user_id, email, status, display_name')
    .eq('group_id', id)
    .eq('status', 'active')

  const memberIds = (rawMembers ?? []).map((m: any) => m.user_id).filter(Boolean)

  const { data: profileData } = memberIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, bgg_username, bgg_collection, availability_planning_months').in('id', memberIds)
    : { data: [] as any[] }
  const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]))
  const members = (rawMembers ?? []).map((m: any) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? null,
  }))

  const currentUserProfile = profileMap.get(user.id)
  const bggUsername: string | null = currentUserProfile?.bgg_username ?? null
  const bggCollection: Array<{ id: number; name: string; thumbnail_url: string | null }> | null =
    Array.isArray(currentUserProfile?.bgg_collection) ? currentUserProfile.bgg_collection : null

  // Verfügbarkeiten aller Mitglieder: Maximaler Planungshorizont der Gruppe.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateString(today)
  const maxPlanningMonths = Math.max(
    1,
    ...(profileData ?? []).map((p: any) => clampPlanningMonths(p.availability_planning_months))
  )
  const { startDate, endDate } = getPlanningRangeFromMonday(maxPlanningMonths, today)
  const startStr = toLocalDateString(startDate)
  const endStr = toLocalDateString(endDate)

  const { data: availabilities } = await supabase
    .from('availability')
    .select('user_id, date, status, from_time, until_time')
    .in('user_id', memberIds)
    .gte('date', startStr)
    .lte('date', endStr)

  // Aktive Events der Gruppe laden (inkl. cancelled, damit sie sichtbar bleiben).
  // Fallback ohne Host-Felder, falls die Migration auf der Ziel-DB noch nicht aktiv ist.
  const eventsQuery = await supabase
    .from('events')
    .select('*, profiles(display_name), event_responses(user_id, response, previous_response, host_offer, profiles(display_name)), event_games(id, bgg_id, name, thumbnail_url, added_by)')
    .eq('group_id', id)
    .in('status', ['voting', 'confirmed', 'cancelled'])
    .gte('proposed_date', todayStr)
    .order('proposed_date')

  const eventsFallbackWithProfiles = eventsQuery.error
    ? await supabase
        .from('events')
        .select('*, profiles(display_name), event_responses(user_id, response, previous_response, profiles(display_name)), event_games(id, bgg_id, name, thumbnail_url, added_by)')
        .eq('group_id', id)
        .in('status', ['voting', 'confirmed', 'cancelled'])
        .gte('proposed_date', todayStr)
        .order('proposed_date')
    : null

  const eventsFallbackWithoutProfiles = (eventsQuery.error && eventsFallbackWithProfiles?.error)
    ? await supabase
        .from('events')
        .select('*, event_responses(user_id, response, previous_response, host_offer), event_games(id, bgg_id, name, thumbnail_url, added_by)')
        .eq('group_id', id)
        .in('status', ['voting', 'confirmed', 'cancelled'])
        .gte('proposed_date', todayStr)
        .order('proposed_date')
    : null

  const events = (
    eventsQuery.data
    ?? eventsFallbackWithProfiles?.data
    ?? eventsFallbackWithoutProfiles?.data
    ?? []
  ).map((event: any) => ({
    ...event,
    host_user_id: event.host_user_id ?? null,
    event_responses: (event.event_responses ?? []).map((response: any) => ({
      ...response,
      host_offer: response.host_offer ?? false,
      profiles: response.profiles ?? { display_name: profileMap.get(response.user_id)?.display_name ?? '?' },
    })),
  }))

  // Blockierte Tage: zugesagte Events in ANDEREN Gruppen (laufende Abstimmung oder bestätigt)
  const { data: otherMemberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('group_id', id)

  const otherGroupIds = (otherMemberships ?? []).map((m: any) => m.group_id as string)

  let blockedDates: string[] = []
  if (otherGroupIds.length > 0) {
    // Events in anderen Gruppen, bei denen der Nutzer zugesagt hat
    // Startpunkt: event_responses (eigene Antworten), join auf events
    const { data: acceptedInOtherGroups } = await supabase
      .from('event_responses')
      .select('event_id, events!inner(id, proposed_date, group_id, status)')
      .eq('user_id', user.id)
      .eq('response', 'accepted')

    blockedDates = (acceptedInOtherGroups ?? [])
      .filter((r: any) => {
        const e = r.events
        return (
          e &&
          (e.status === 'voting' || e.status === 'confirmed') &&
          otherGroupIds.includes(e.group_id) &&
          e.proposed_date >= todayStr &&
          e.proposed_date <= endStr
        )
      })
      .map((r: any) => r.events.proposed_date as string)
  }

  // Vergangene bestätigte Termine (Archiv), ebenfalls mit Fallback.
  const pastEventsQuery = await supabase
    .from('events')
    .select('id, proposed_date, from_time, until_time, host_user_id, event_responses(response, user_id, host_offer), event_games(id, bgg_id, name, thumbnail_url, added_by)')
    .eq('group_id', id)
    .eq('status', 'confirmed')
    .lt('proposed_date', todayStr)
    .order('proposed_date', { ascending: false })
    .limit(30)

  const pastEventsFallback = pastEventsQuery.error
    ? await supabase
        .from('events')
        .select('id, proposed_date, from_time, until_time, event_responses(response, user_id), event_games(id, bgg_id, name, thumbnail_url, added_by)')
        .eq('group_id', id)
        .eq('status', 'confirmed')
        .lt('proposed_date', todayStr)
        .order('proposed_date', { ascending: false })
        .limit(30)
    : null

  const pastEvents = (
    pastEventsQuery.data
    ?? pastEventsFallback?.data
    ?? []
  ).map((event: any) => ({
    ...event,
    host_user_id: event.host_user_id ?? null,
    event_responses: (event.event_responses ?? []).map((response: any) => ({
      ...response,
      host_offer: response.host_offer ?? false,
    })),
  }))

  // Für den Hinweis im "Nächste"-Tab: gleiche Tage gruppenübergreifend vergleichen.
  const currentMemberProfiles = members.map((member: any) => ({
    id: member.user_id,
    display_name: member.display_name ?? member.profiles?.display_name ?? member.email?.split('@')[0] ?? '?',
  }))
  const currentNameById = new Map(currentMemberProfiles.map((profile: any) => [profile.id, profile.display_name]))
  const currentAvailabilities = (availabilities ?? []).map((availability: any) => ({
    ...availability,
    profiles: {
      id: availability.user_id,
      display_name: currentNameById.get(availability.user_id) ?? '?',
    },
  }))
  const currentOverlaps = computeOverlaps(
    currentAvailabilities as any,
    currentMemberProfiles as any,
    group.min_participants,
    parseISO(startStr),
    parseISO(endStr)
  )

  const betterGroupByDate: Record<string, string> = {}
  if (otherGroupIds.length > 0) {
    const { data: otherGroups } = await supabase
      .from('groups')
      .select('id, name, min_participants')
      .in('id', otherGroupIds)

    const { data: otherRawMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id, email, display_name')
      .in('group_id', otherGroupIds)
      .eq('status', 'active')

    const otherMemberIds = Array.from(new Set((otherRawMembers ?? []).map((member: any) => member.user_id).filter(Boolean)))
    const { data: otherProfiles } = otherMemberIds.length > 0
      ? await supabase.from('profiles').select('id, display_name').in('id', otherMemberIds)
      : { data: [] as any[] }

    const otherProfileMap = new Map((otherProfiles ?? []).map((profile: any) => [profile.id, profile.display_name]))

    const { data: otherAvailabilitiesRaw } = otherMemberIds.length > 0
      ? await supabase
          .from('availability')
          .select('user_id, date, status, from_time, until_time')
          .in('user_id', otherMemberIds)
          .gte('date', startStr)
          .lte('date', endStr)
      : { data: [] as any[] }

    const availabilitiesByUser = new Map<string, any[]>()
    for (const availability of otherAvailabilitiesRaw ?? []) {
      const existing = availabilitiesByUser.get(availability.user_id) ?? []
      existing.push(availability)
      availabilitiesByUser.set(availability.user_id, existing)
    }

    for (const overlap of currentOverlaps) {
      const currentAccepted = overlap.confirmed_participants.length
      const currentUncertain = overlap.uncertain_participants.length
      let bestOther: { name: string; accepted: number; uncertain: number } | null = null

      for (const otherGroup of otherGroups ?? []) {
        const groupMembers = (otherRawMembers ?? []).filter((member: any) => member.group_id === otherGroup.id && member.user_id)
        if (groupMembers.length === 0) continue

        const memberProfiles = groupMembers.map((member: any) => ({
          id: member.user_id,
          display_name: member.display_name ?? otherProfileMap.get(member.user_id) ?? member.email?.split('@')[0] ?? '?',
        }))
        const groupAvailabilities = groupMembers.flatMap((member: any) => {
          const userAvailabilities = availabilitiesByUser.get(member.user_id) ?? []
          const displayName = member.display_name ?? otherProfileMap.get(member.user_id) ?? member.email?.split('@')[0] ?? '?'
          return userAvailabilities.map((availability: any) => ({
            ...availability,
            profiles: { id: availability.user_id, display_name: displayName },
          }))
        })

        const otherOverlaps = computeOverlaps(
          groupAvailabilities as any,
          memberProfiles as any,
          otherGroup.min_participants,
          parseISO(startStr),
          parseISO(endStr)
        )
        const sameDate = otherOverlaps.find((entry) => entry.date === overlap.date)
        if (!sameDate) continue

        const accepted = sameDate.confirmed_participants.length
        const uncertain = sameDate.uncertain_participants.length
        const isBetter = accepted > currentAccepted || (accepted === currentAccepted && uncertain > currentUncertain)
        if (!isBetter) continue

        if (!bestOther || accepted > bestOther.accepted || (accepted === bestOther.accepted && uncertain > bestOther.uncertain)) {
          bestOther = { name: otherGroup.name, accepted, uncertain }
        }
      }

      if (bestOther) {
        betterGroupByDate[overlap.date] = bestOther.name
      }
    }
  }

  return (
    <GruppenDetailClient
      group={group}
      members={members ?? []}
      availabilities={availabilities ?? []}
      events={events ?? []}
      pastEvents={pastEvents ?? []}
      currentUserId={user.id}
      startDate={startStr}
      endDate={endStr}
      blockedDates={blockedDates}
      betterGroupByDate={betterGroupByDate}
      bggUsername={bggUsername}
      bggCollection={bggCollection}
    />
  )
}
