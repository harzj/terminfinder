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

  const { data: members } = await supabase
    .from('group_members')
    .select('*, profiles(display_name)')
    .eq('group_id', id)
    .order('joined_at')

  return (
    <GruppenEinstellungenClient
      group={group}
      members={members ?? []}
      currentUserId={user.id}
    />
  )
}
