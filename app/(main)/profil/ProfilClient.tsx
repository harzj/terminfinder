'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2, LogOut } from 'lucide-react'

interface Membership {
  id: string
  group_id: string
  display_name: string | null
  group_name: string
}

interface Props {
  profile: { id: string; display_name: string; bgg_username: string | null }
  email: string
  memberships: Membership[]
}

export default function ProfilClient({ profile, email, memberships }: Props) {
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bggUsername, setBggUsername] = useState(profile.bgg_username ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [groupNames, setGroupNames] = useState<Record<string, string>>(
    Object.fromEntries(memberships.map((m) => [m.id, m.display_name ?? '']))
  )
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [savedGroup, setSavedGroup] = useState<string | null>(null)

  const handleSaveProfile = async () => {
    if (!displayName.trim() || savingProfile) return
    setSavingProfile(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), bgg_username: bggUsername.trim() || null })
      .eq('id', profile.id)
    setSavingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
    router.refresh()
  }

  const handleSaveGroupName = async (membershipId: string) => {
    if (savingGroup) return
    setSavingGroup(membershipId)
    const supabase = createClient()
    await supabase
      .from('group_members')
      .update({ display_name: groupNames[membershipId]?.trim() || null })
      .eq('id', membershipId)
    setSavingGroup(null)
    setSavedGroup(membershipId)
    setTimeout(() => setSavedGroup(null), 2000)
    router.refresh()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/anmelden')
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">Profil</h1>
      <p className="text-sm text-muted-foreground -mt-3">{email}</p>

      {/* Globale Einstellungen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allgemein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bggUsername">BoardGameGeek-Nutzername</Label>
            <Input
              id="bggUsername"
              value={bggUsername}
              onChange={(e) => setBggUsername(e.target.value)}
              placeholder="dein-bgg-name"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              Wird verwendet, um deine BGG-Sammlung beim Spieleintrag zu laden.
            </p>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile || !displayName.trim()}
            size="sm"
            className="w-full"
          >
            {savingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : profileSaved ? (
              <><Check className="h-4 w-4 mr-1" /> Gespeichert</>
            ) : (
              'Speichern'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Per-Gruppen-Namen */}
      {memberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Name pro Gruppe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Überschreibt deinen Anzeigenamen nur in dieser Gruppe. Leer lassen für globalen Namen.
            </p>
            {memberships.map((m) => (
              <div key={m.id} className="space-y-1.5">
                <Label className="text-sm font-medium">{m.group_name}</Label>
                <div className="flex gap-2">
                  <Input
                    value={groupNames[m.id] ?? ''}
                    onChange={(e) => setGroupNames((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder={`Globaler Name (${profile.display_name})`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveGroupName(m.id)}
                    disabled={savingGroup === m.id}
                    className="shrink-0"
                  >
                    {savingGroup === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedGroup === m.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      'OK'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Abmelden */}
      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Abmelden
      </Button>
    </div>
  )
}
