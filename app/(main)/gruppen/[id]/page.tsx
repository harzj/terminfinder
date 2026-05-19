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
    .select('user_id, email, status')
    .eq('group_id', id)
    .eq('status', 'active')

  const memberIds = (rawMembers ?? []).map((m: any) => m.user_id).filter(Boolean)

  const { data: profileData } = memberIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', memberIds)
    : { data: [] as any[] }
  const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]))
  const members = (rawMembers ?? []).map((m: any) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? null,
  }))

  // Verfügbarkeiten aller Mitglieder für nächste 28 Tage
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 27)
  const todayStr = today.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  const { data: availabilities } = await supabase
    .from('availability')
    .select('user_id, date, status, from_time, until_time')
    .in('user_id', memberIds)
    .gte('date', todayStr)
    .lte('date', endStr)

  // Aktive Events der Gruppe laden
  const { data: events } = await supabase
    .from('events')
    .select('*, profiles(display_name), event_responses(user_id, response, profiles(display_name))')
    .eq('group_id', id)
    .in('status', ['voting', 'confirmed'])
    .gte('proposed_date', todayStr)
    .order('proposed_date')

  // Blockierte Tage: bestätigte Events in ANDEREN Gruppen des Nutzers (unabhängig von dessen Antwort)
  const { data: otherMemberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('group_id', id)

  const otherGroupIds = (otherMemberships ?? []).map((m: any) => m.group_id as string)

  let blockedDates: string[] = []
  if (otherGroupIds.length > 0) {
    const { data: otherEvents } = await supabase
      .from('events')
      .select('proposed_date')
      .in('group_id', otherGroupIds)
      .eq('status', 'confirmed')
      .gte('proposed_date', todayStr)
      .lte('proposed_date', endStr)
    blockedDates = (otherEvents ?? []).map((e: any) => e.proposed_date as string)
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
      startDate={todayStr}
      endDate={endStr}
      blockedDates={blockedDates}
    />
  )
}
