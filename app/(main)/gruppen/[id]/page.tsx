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

  // Mitglieder laden
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, email, status, profiles(display_name)')
    .eq('group_id', id)
    .eq('status', 'active')

  // Verfügbarkeiten aller Mitglieder für nächste 28 Tage
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 27)
  const todayStr = today.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  const memberIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean)

  const { data: availabilities } = await supabase
    .from('availability')
    .select('*, profiles(display_name)')
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

  return (
    <GruppenDetailClient
      group={group}
      members={members ?? []}
      availabilities={availabilities ?? []}
      events={events ?? []}
      currentUserId={user.id}
      startDate={todayStr}
      endDate={endStr}
    />
  )
}
