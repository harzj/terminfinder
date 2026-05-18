import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VerfuegbarkeitClient from './VerfuegbarkeitClient'

export default async function VerfuegbarkeitPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  // Verfügbarkeit der nächsten 28 Tage laden
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 27)

  const { data: availability } = await supabase
    .from('availability')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', today.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date')

  // Bestätigte Events holen (für Sperr-Anzeige)
  const { data: confirmedEvents } = await supabase
    .from('event_responses')
    .select('events(proposed_date, groups(name))')
    .eq('user_id', user.id)
    .eq('response', 'accepted')

  const events = (confirmedEvents ?? []).flatMap((er: any) =>
    er.events
      ? [{ date: er.events.proposed_date, group_name: er.events.groups?.name ?? '' }]
      : []
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-1">Meine Verfügbarkeit</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Tippe auf einen Tag, um deine Verfügbarkeit einzutragen.
      </p>
      <VerfuegbarkeitClient
        userId={user.id}
        initialAvailability={availability ?? []}
        confirmedEvents={events}
      />
    </div>
  )
}
