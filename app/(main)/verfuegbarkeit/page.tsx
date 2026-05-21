import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, AlertTriangle } from 'lucide-react'
import VerfuegbarkeitClient from './VerfuegbarkeitClient'
import LaufendeAbstimmungen from './LaufendeAbstimmungen'
import { DefaultTimes } from '@/lib/holidays'

export default async function VerfuegbarkeitPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  // Heutiges Datum + Montag der aktuellen Woche
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const dayOfWeek = today.getDay() // 0=So, 1=Mo, ...
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + daysToMonday)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // 5 volle Wochen = 35 Tage
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 34)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Verfügbarkeit für das gesamte 5-Wochen-Fenster laden
  const { data: availability } = await supabase
    .from('availability')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr)
    .order('date')

  // Bestätigte Events holen (für Sperr-Anzeige im Kalender)
  const { data: confirmedEvents } = await supabase
    .from('event_responses')
    .select('events(id, group_id, proposed_date, groups(name))')
    .eq('user_id', user.id)
    .eq('response', 'accepted')

  const calendarEvents = (confirmedEvents ?? []).flatMap((er: any) =>
    er.events
      ? [{ date: er.events.proposed_date, group_name: er.events.groups?.name ?? '' }]
      : []
  )

  // Standard-Uhrzeiten aus Profil
  const { data: profileData } = await supabase
    .from('profiles')
    .select('default_availability_times')
    .eq('id', user.id)
    .single()
  const defaultTimes = (profileData?.default_availability_times as DefaultTimes | null) ?? null

  // Gruppen des Nutzers ermitteln
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const groupIds = (memberships ?? []).map((m: any) => m.group_id)

  // Dashboard: Bevorstehende bestätigte Termine (alle Gruppen)
  const upcomingConfirmed = groupIds.length > 0
    ? (await supabase
        .from('events')
        .select('id, group_id, proposed_date, from_time, until_time, groups(id, name), event_responses(user_id, response, previous_response)')
        .in('group_id', groupIds)
        .eq('status', 'confirmed')
        .gte('proposed_date', todayStr)
        .order('proposed_date')
        .limit(5)
      ).data ?? []
    : []

  // Dashboard: Laufende Abstimmungen (alle Gruppen)
  const activeVotings = groupIds.length > 0
    ? (await supabase
        .from('events')
        .select('id, group_id, proposed_date, from_time, until_time, groups(id, name), event_responses(user_id, response)')
        .in('group_id', groupIds)
        .eq('status', 'voting')
        .gte('proposed_date', todayStr)
        .order('proposed_date')
        .limit(10)
      ).data ?? []
    : []

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">

      {/* ── Bevorstehende Termine ──────────────────── */}
      {upcomingConfirmed.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-green-600" /> Nächste Termine
          </h2>
          <div className="space-y-2">
            {upcomingConfirmed.map((event: any) => {
              const hasChanges = (event.event_responses ?? []).some(
                (r: any) => r.previous_response === 'accepted' && r.response !== 'accepted'
              )
              return (
              <Link key={event.id} href={`/gruppen/${event.group_id}`}>
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de })}
                      {hasChanges && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    </p>
                    {event.from_time && (
                      <p className="text-xs text-muted-foreground">
                        {event.from_time.slice(0, 5)}{event.until_time ? ` – ${event.until_time.slice(0, 5)}` : ''} Uhr
                      </p>
                    )}
                  </div>
                  <Badge className="bg-green-600 shrink-0 text-xs">{event.groups?.name ?? ''}</Badge>
                </div>
              </Link>
            )
            })}
          </div>
        </section>
      )}

      {/* ── Laufende Abstimmungen ──────────────────── */}
      {activeVotings.length > 0 && (
        <LaufendeAbstimmungen
          events={activeVotings}
          userId={user.id}
          availability={(availability ?? []).map((a: any) => ({ date: a.date, status: a.status }))}
        />
      )}

      {/* ── Verfügbarkeitskalender ─────────────────── */}
      <section>
        <h2 className="text-base font-semibold mb-1">Meine Verfügbarkeit</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Tippe auf einen Tag, um deine Verfügbarkeit einzutragen.
        </p>
        <VerfuegbarkeitClient
          userId={user.id}
          startDate={weekStartStr}
          todayStr={todayStr}
          initialAvailability={availability ?? []}
          confirmedEvents={calendarEvents}
          defaultTimes={defaultTimes}
        />
      </section>
    </div>
  )
}

