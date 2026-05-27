import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilClient from './ProfilClient'
import { DefaultTimes } from '@/lib/holidays'
import { DayAvailability } from '@/components/AvailabilityCalendar'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, bgg_username, bgg_collection, default_availability_times, calendar_token, calendar_import_url, auto_sync_enabled, auto_sync_urls, auto_sync_min_distance_hours')
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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dow = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  const weekStartStr = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
  const weekEnd = new Date(mon)
  weekEnd.setDate(mon.getDate() + 34)
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`

  const { data: availabilityData } = await supabase
    .from('availability')
    .select('date, status, from_time, until_time')
    .eq('user_id', user.id)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr)

  return (
    <ProfilClient
      profile={profile ?? { id: user.id, display_name: '', bgg_username: null, bgg_collection: null, default_availability_times: null, calendar_token: '', calendar_import_url: null }}
      email={user.email ?? ''}
      memberships={memberships}
      bggCollectionCount={Array.isArray(profile?.bgg_collection) ? (profile.bgg_collection as unknown[]).length : 0}
      defaultTimes={(profile?.default_availability_times as DefaultTimes | null) ?? null}
      calendarToken={profile?.calendar_token ?? ''}
      calendarImportUrl={profile?.calendar_import_url ?? null}
      startDate={weekStartStr}
      todayStr={todayStr}
      initialAvailability={(availabilityData ?? []) as DayAvailability[]}
      autoSyncEnabled={profile?.auto_sync_enabled ?? false}
      autoSyncUrls={(profile?.auto_sync_urls as string[] | null) ?? []}
      autoSyncMinDistance={profile?.auto_sync_min_distance_hours ?? 3}
    />
  )
}
