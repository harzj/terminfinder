import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import EinladenClient from './EinladenClient'

export default async function EinladenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Einladung laden
  const { data: memberRaw } = await supabase
    .from('group_members')
    .select('*, groups(id, name, description)')
    .eq('invite_code', code)
    .single()

  interface MemberWithGroup {
    id: string
    group_id: string
    user_id: string | null
    email: string
    status: 'pending' | 'active'
    invite_code: string
    invited_by: string | null
    joined_at: string | null
    groups?: { id: string; name: string; description: string | null } | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = memberRaw as any as MemberWithGroup | null

  if (!member) notFound()
  if (member.status === 'active') {
    // Bereits aktiv → direkt zur Gruppe
    redirect(`/gruppen/${member.group_id}`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Wenn eingeloggt → direkt beitreten
  if (user) {
    await supabase.from('group_members').update({
      user_id: user.id,
      email: user.email!,
      status: 'active',
      joined_at: new Date().toISOString(),
    }).eq('invite_code', code)

    redirect(`/gruppen/${member.group_id}`)
  }

  // Nicht eingeloggt → Landing Page anzeigen
  return (
    <EinladenClient
      groupName={member.groups?.name ?? 'Gruppe'}
      groupDescription={member.groups?.description ?? null}
      inviteCode={code}
    />
  )
}
