import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilClient from './ProfilClient'
import { DefaultTimes } from '@/lib/holidays'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, bgg_username, bgg_collection, default_availability_times, calendar_token, calendar_import_url')
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

  return (
    <ProfilClient
      profile={profile ?? { id: user.id, display_name: '', bgg_username: null, bgg_collection: null, default_availability_times: null }}
      email={user.email ?? ''}
      memberships={memberships}
      bggCollectionCount={Array.isArray(profile?.bgg_collection) ? (profile.bgg_collection as any[]).length : 0}
      defaultTimes={(profile?.default_availability_times as DefaultTimes | null) ?? null}
      calendarToken={(profile as any)?.calendar_token ?? ''}
      calendarImportUrl={(profile as any)?.calendar_import_url ?? null}
    />
  )
}
