'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Copy, Check, UserPlus, Trash2, RefreshCw } from 'lucide-react'

interface Props {
  group: any
  members: any[]
  currentUserId: string
}

export default function GruppenEinstellungenClient({ group, members, currentUserId }: Props) {
  const router = useRouter()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [minParticipants, setMinParticipants] = useState(group.min_participants)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [joinCode, setJoinCode] = useState<string>(group.join_code ?? '')
  const [copiedJoinCode, setCopiedJoinCode] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Invite-Link eines Mitglieds kopieren
  const copyLink = (code: string) => {
    const url = `${window.location.origin}/einladen/${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  // Allgemeinen Einladungslink erzeugen oder bestehenden abrufen
  const generateInviteLink = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('group_members')
      .upsert(
        { group_id: group.id, email: '__link__', status: 'pending', invited_by: currentUserId },
        { onConflict: 'group_id,email', ignoreDuplicates: false }
      )
      .select('invite_code')
      .single()
    if (data) {
      copyLink(data.invite_code)
      router.refresh()
    }
  }

  // Gruppe löschen
  const handleDeleteGroup = async () => {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('groups').delete().eq('id', group.id)
    if (!error) {
      router.push('/gruppen')
    } else {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Per E-Mail einladen
  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)
    const supabase = createClient()
    const { error } = await supabase.from('group_members').insert({
      group_id: group.id,
      email: inviteEmail.trim().toLowerCase(),
      status: 'pending',
      invited_by: currentUserId,
    })
    if (error) {
      setInviteError(error.code === '23505' ? 'Diese Person ist bereits eingeladen.' : 'Fehler beim Einladen.')
    } else {
      setInviteEmail('')
      router.refresh()
    }
    setInviting(false)
  }

  // Join-Code erneuern
  const handleRegenerateCode = async () => {
    setRegenerating(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('regenerate_join_code', { p_group_id: group.id })
    if (!error && data) setJoinCode(data)
    setRegenerating(false)
  }

  // Join-Code kopieren
  const copyJoinCode = () => {
    navigator.clipboard.writeText(joinCode)
    setCopiedJoinCode(true)
    setTimeout(() => setCopiedJoinCode(false), 2000)
  }

  // Mindest-Teilnehmer speichern
  const handleSaveMin = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('groups').update({ min_participants: minParticipants }).eq('id', group.id)
    setSaving(false)
    router.refresh()
  }

  // Mitglied entfernen
  const handleRemove = async (memberId: string) => {
    const supabase = createClient()
    await supabase.from('group_members').delete().eq('id', memberId)
    router.refresh()
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/gruppen/${group.id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Gruppeneinstellungen</h1>
      </div>

      {/* Einstellungen */}
      <Card>
        <CardHeader><CardTitle className="text-base">Grundeinstellungen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="min">Mindest-Teilnehmer</Label>
            <div className="flex gap-2">
              <Input
                id="min"
                type="number"
                min={2}
                max={20}
                value={minParticipants}
                onChange={(e) => setMinParticipants(Number(e.target.value))}
              />
              <Button onClick={handleSaveMin} disabled={saving} variant="outline" size="sm">
                {saving ? '…' : 'Speichern'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beitrittscode */}
      {joinCode && (
        <Card>
          <CardHeader><CardTitle className="text-base">Beitrittscode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Teile diesen Code, damit andere direkt beitreten können.</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-[0.3em] flex-1">{joinCode}</span>
              <button onClick={copyJoinCode} className="text-muted-foreground hover:text-foreground" title="Code kopieren">
                {copiedJoinCode ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
            <Button
              onClick={handleRegenerateCode}
              disabled={regenerating}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Wird erneuert…' : 'Code erneuern'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Einladungslink */}
      <Card>
        <CardHeader><CardTitle className="text-base">Einladen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Allgemeiner Link – jeder mit dem Link kann beitreten:</p>
            <Button onClick={generateInviteLink} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" /> Link kopieren
            </Button>
          </div>
          <div className="border-t border-border" />
          <form onSubmit={handleInviteByEmail} className="space-y-2">
            <Label htmlFor="email">Für bestimmte Person einladen</Label>
            {/* suppressHydrationWarning: Passwort-Manager-Extensions injizieren style + button */}
            <div className="flex gap-2" suppressHydrationWarning>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="person@beispiel.de"
                required
                suppressHydrationWarning
              />
              <Button type="submit" disabled={inviting} size="sm">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Es wird keine E-Mail versendet – kopiere den Link aus der Mitgliederliste und schicke ihn selbst.</p>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </form>
        </CardContent>
      </Card>

      {/* Mitgliederliste */}
      <Card>
        <CardHeader><CardTitle className="text-base">Mitglieder ({members.filter(m => m.status === 'active').length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.map((member: any) => (
            <div key={member.id} className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.profiles?.display_name ?? member.email}
                </p>
                {member.profiles?.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.status === 'pending' && (
                  <Badge variant="outline" className="text-xs">Ausstehend</Badge>
                )}
                {member.invite_code && (
                  <button onClick={() => copyLink(member.invite_code)} className="text-muted-foreground hover:text-foreground">
                    {copied === member.invite_code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                {member.user_id !== currentUserId && (
                  <button onClick={() => handleRemove(member.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Gefahrenzone */}
      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-base text-destructive">Gefahrenzone</CardTitle></CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} className="w-full">
              <Trash2 className="h-4 w-4 mr-2" /> Gruppe löschen
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">Wirklich löschen? Alle Daten gehen verloren.</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDeleteGroup} disabled={deleting} className="flex-1">
                  {deleting ? 'Wird gelöscht…' : 'Ja, löschen'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
