import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import EinladenClient from './EinladenClient'

export default async function EinladenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Einladung laden via SECURITY DEFINER Funktion (umgeht RLS für anon-Nutzer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any).rpc('get_invite_info', { p_code: code })
  const invite = rows?.[0] ?? null

  if (!invite) notFound()

  if (invite.member_status === 'active') {
    redirect(`/gruppen/${invite.group_id}`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Wenn eingeloggt → Invite annehmen via SECURITY DEFINER Funktion
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupId } = await (supabase as any).rpc('accept_invite', { p_code: code })
    const targetGroupId = groupId ?? invite.group_id
    redirect(`/gruppen/${targetGroupId}`)
  }

  // Nicht eingeloggt → Landing Page anzeigen
  return (
    <EinladenClient
      groupName={invite.group_name ?? 'Gruppe'}
      groupDescription={invite.group_description ?? null}
      inviteCode={code}
    />
  )
}
