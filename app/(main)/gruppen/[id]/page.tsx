import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GruppenDetailClient from './GruppenDetailClient'

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
    ? await supabase.from('profiles').select('id, display_name, bgg_username, bgg_collection').in('id', memberIds)
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

  // Verfügbarkeiten aller Mitglieder: 5 Wochen ab Montag der aktuellen Woche (synchron mit Verfügbarkeitskalender)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + daysToMonday)
  const startStr = weekStart.toISOString().split('T')[0]
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 34)
  const endStr = weekEnd.toISOString().split('T')[0]

  const { data: availabilities } = await supabase
    .from('availability')
    .select('user_id, date, status, from_time, until_time')
    .in('user_id', memberIds)
    .gte('date', startStr)
    .lte('date', endStr)

  // Aktive Events der Gruppe laden (inkl. cancelled, damit sie sichtbar bleiben)
  const { data: events } = await supabase
    .from('events')
    .select('*, profiles(display_name), event_responses(user_id, response, previous_response, profiles(display_name)), event_games(id, bgg_id, name, thumbnail_url, added_by)')
    .eq('group_id', id)
    .in('status', ['voting', 'confirmed', 'cancelled'])
    .gte('proposed_date', todayStr)
    .order('proposed_date')

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

  // Vergangene bestätigte Termine (Archiv)
  const { data: pastEvents } = await supabase
    .from('events')
    .select('id, proposed_date, from_time, until_time, event_responses(response, user_id), event_games(id, bgg_id, name, thumbnail_url, added_by)')
    .eq('group_id', id)
    .eq('status', 'confirmed')
    .lt('proposed_date', todayStr)
    .order('proposed_date', { ascending: false })
    .limit(30)

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
      bggUsername={bggUsername}
      bggCollection={bggCollection}
    />
  )
}
