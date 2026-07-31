import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilClient from './ProfilClient'
import { DefaultTimes } from '@/lib/holidays'
import { DayAvailability } from '@/components/AvailabilityCalendar'
import { decryptUrl } from '@/lib/encryption'
import { clampPlanningMonths, getPlanningRangeFromMonday, toLocalDateString } from '@/lib/planningWindow'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, bgg_username, bgg_collection, default_availability_times, availability_planning_months, onboarding_tour_seen_at, calendar_token, calendar_import_url, auto_sync_enabled, auto_sync_urls, auto_sync_min_distance_hours')
    .eq('id', user.id)
    .single()

  // Gruppen-Mitgliedschaften mit per-Gruppen-Name
  const { data: rawMemberships } = await supabase
    .from('group_members')
    .select('id, group_id, display_name')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const groupIds = (rawMemberships ?? []).map((m: any) => m.group_id as string)
  const { data: groups } = groupIds.length > 0
    ? await supabase.from('groups').select('id, name').in('id', groupIds)
    : { data: [] as any[] }

  const groupMap = new Map((groups ?? []).map((g: any) => [g.id, g.name as string]))
  const memberships = (rawMemberships ?? []).map((m: any) => ({
    id: m.id as string,
    group_id: m.group_id as string,
    display_name: m.display_name as string | null,
    group_name: groupMap.get(m.group_id) ?? 'Unbekannte Gruppe',
  }))

  // Date range for CalendarImport (use local date parts to avoid UTC shift)
  const now = new Date()
  const todayStr = toLocalDateString(now)
  // Planungshorizont steuert, wie weit der Kalender in die Zukunft lädt.
  const planningMonths = clampPlanningMonths(profile?.availability_planning_months)
  const { startDate, endDate } = getPlanningRangeFromMonday(planningMonths, now)
  const weekStartStr = toLocalDateString(startDate)
  const weekEndStr = toLocalDateString(endDate)

  const { data: availabilityData } = await supabase
    .from('availability')
    .select('date, status, from_time, until_time')
    .eq('user_id', user.id)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr)

  return (
    <ProfilClient
      profile={profile ?? { id: user.id, display_name: '', bgg_username: null }}
      email={user.email ?? ''}
      memberships={memberships}
      bggCollectionCount={Array.isArray(profile?.bgg_collection) ? (profile.bgg_collection as unknown[]).length : 0}
      defaultTimes={(profile?.default_availability_times as DefaultTimes | null) ?? null}
      calendarToken={profile?.calendar_token ?? ''}
      calendarImportUrl={profile?.calendar_import_url ? decryptUrl(profile.calendar_import_url) : null}
      startDate={weekStartStr}
      todayStr={todayStr}
      initialAvailability={(availabilityData ?? []) as DayAvailability[]}
      autoSyncEnabled={profile?.auto_sync_enabled ?? false}
      autoSyncUrls={((profile?.auto_sync_urls as string[] | null) ?? []).map(decryptUrl)}
      autoSyncMinDistance={profile?.auto_sync_min_distance_hours ?? 3}
      planningMonths={planningMonths}
    />
  )
}
