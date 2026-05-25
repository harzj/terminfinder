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
    .select('default_availability_times, calendar_import_url')
    .eq('id', user.id)
    .single()
  const defaultTimes = (profileData?.default_availability_times as DefaultTimes | null) ?? null
  const calendarImportUrl = profileData?.calendar_import_url ?? null

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
        .select('id, group_id, proposed_date, from_time, until_time, min_participants, groups(id, name), event_responses(user_id, response, previous_response), event_games(id, name, thumbnail_url)')
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
              const games = event.event_games ?? []
              const hasChanges = (event.event_responses ?? []).some(
                (r: any) => r.previous_response === 'accepted' && r.response !== 'accepted'
              )
              const acceptedCount = (event.event_responses ?? []).filter((r: any) => r.response === 'accepted').length
              const belowThreshold = acceptedCount < (event.min_participants ?? 0)

              const cardClasses = belowThreshold
                ? 'rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 flex items-center justify-between gap-3'
                : hasChanges
                  ? 'rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 flex items-center justify-between gap-3'
                  : 'rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3 flex items-center justify-between gap-3'

              const alertColor = belowThreshold ? 'text-red-500' : 'text-amber-500'

              return (
              <Link key={event.id} href={`/gruppen/${event.group_id}?tab=abstimmungen`}>
                <div className={cardClasses}>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de })}
                      {hasChanges && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${alertColor}`} />}
                    </p>
                    {event.from_time && (
                      <p className="text-xs text-muted-foreground">
                        {event.from_time.slice(0, 5)}{event.until_time ? ` – ${event.until_time.slice(0, 5)}` : ''} Uhr
                      </p>
                    )}
                    {games.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        {games.slice(0, 6).map((game: any) => (
                          game.thumbnail_url ? (
                            <img
                              key={game.id}
                              src={game.thumbnail_url}
                              alt={game.name}
                              className="h-9 w-[27px] rounded object-cover"
                            />
                          ) : (
                            <div
                              key={game.id}
                              className="h-9 w-[27px] rounded bg-muted"
                              title={game.name}
                            />
                          )
                        ))}
                        {games.length > 6 && (
                          <span className="text-[10px] text-muted-foreground ml-1">+{games.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge className="bg-green-600 shrink-0 text-xs">{event.groups?.name ?? ''}</Badge>
                </div>
              </Link>
            )
            })}
          </div>
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
        <VerfuegbarkeitClient
          userId={user.id}
          startDate={weekStartStr}
          todayStr={todayStr}
          initialAvailability={availability ?? []}
          confirmedEvents={calendarEvents}
          defaultTimes={defaultTimes}
          calendarImportUrl={calendarImportUrl}
        />
      </section>
    </div>
  )
}

