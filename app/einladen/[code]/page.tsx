import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import EinladenClient from './EinladenClient'

export default async function EinladenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Einladung laden via SECURITY DEFINER Funktion (umgeht RLS für anon-Nutzer)
  const { data: rows } = await supabase.rpc('get_invite_info', { p_code: code })
  const invite = rows?.[0] ?? null

  if (!invite) notFound()

  if (invite.member_status === 'active') {
    redirect(`/gruppen/${invite.group_id}`)
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

    redirect(`/gruppen/${invite.group_id}`)
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
