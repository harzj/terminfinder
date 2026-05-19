import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GruppenEinstellungenClient from './GruppenEinstellungenClient'

export default async function GruppenEinstellungenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const { data: group } = await supabase.from('groups').select('*').eq('id', id).single()
  if (!group || group.created_by !== user.id) notFound()

  const { data: rawMembers } = await supabase
    .from('group_members')
    .select('id, user_id, email, status, invite_code, joined_at')
    .eq('group_id', id)
    .order('joined_at')

  const memberUserIds = (rawMembers ?? []).map((m: any) => m.user_id).filter(Boolean)
  const { data: profileData } = memberUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', memberUserIds)
    : { data: [] as any[] }
  const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]))
  const members = (rawMembers ?? []).map((m: any) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? null,
  }))

  return (
    <GruppenEinstellungenClient
      group={group}
      members={members ?? []}
      currentUserId={user.id}
    />
  )
}
