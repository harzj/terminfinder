'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2, LogOut, RefreshCw, CalendarDays, Copy } from 'lucide-react'
import CalendarImport from '@/components/CalendarImport'
import { DayAvailability } from '@/components/AvailabilityCalendar'
import { DefaultTimes } from '@/lib/holidays'

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
  bggCollectionCount: number
  defaultTimes: DefaultTimes | null
  calendarToken: string
  calendarImportUrl: string | null
}

export default function ProfilClient({ profile, email, memberships, bggCollectionCount, defaultTimes, calendarToken, calendarImportUrl: initialImportUrl }: Props) {
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bggUsername, setBggUsername] = useState(profile.bgg_username ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [syncingCollection, setSyncingCollection] = useState(false)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Default availability times
  type TimesState = { start: string; end: string }
  const [workday, setWorkday] = useState<TimesState>(defaultTimes?.workday ?? { start: '18:00', end: '22:00' })
  const [preFree, setPreFree] = useState<TimesState>(defaultTimes?.pre_free ?? { start: '18:00', end: '23:30' })
  const [freeDay, setFreeDay] = useState<TimesState>(defaultTimes?.free_day ?? { start: '10:00', end: '22:00' })
  const [timesEnabled, setTimesEnabled] = useState(defaultTimes !== null)
  const [savingTimes, setSavingTimes] = useState(false)
  const [timesSaved, setTimesSaved] = useState(false)

  const [groupNames, setGroupNames] = useState<Record<string, string>>(
    Object.fromEntries(memberships.map((m) => [m.id, m.display_name ?? '']))
  )
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [savedGroup, setSavedGroup] = useState<string | null>(null)

  // Calendar integration
  const [importUrl, setImportUrl] = useState(initialImportUrl ?? '')
  const [savingImportUrl, setSavingImportUrl] = useState(false)
  const [importUrlSaved, setImportUrlSaved] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const handleSaveTimes = async () => {
    setSavingTimes(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({
        default_availability_times: timesEnabled
          ? { workday, pre_free: preFree, free_day: freeDay }
          : null,
      })
      .eq('id', profile.id)
    setSavingTimes(false)
    setTimesSaved(true)
    setTimeout(() => setTimesSaved(false), 2000)
    router.refresh()
  }

  const handleSyncCollection = async () => {
    const name = bggUsername.trim()
    if (!name || syncingCollection) return
    setSyncingCollection(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/bgg?action=collection&username=${encodeURIComponent(name)}`)
      if (!res.ok) {
        setSyncError('BGG-Sammlung konnte nicht geladen werden. Bitte später erneut versuchen.')
        return
      }
      const collection = await res.json()
      const supabase = createClient()
      await supabase.from('profiles').update({ bgg_collection: collection }).eq('id', profile.id)
      setSyncedCount(collection.length)
      router.refresh()
    } finally {
      setSyncingCollection(false)
    }
  }

  const handleCopyWebcal = () => {
    const host = typeof window !== 'undefined' ? window.location.host : ''
    const webcalUrl = `webcal://${host}/api/calendar/${calendarToken}/events.ics`
    navigator.clipboard.writeText(webcalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSaveImportUrl = async () => {
    setSavingImportUrl(true)
    const supabase = createClient()
    await (supabase as any).from('profiles').update({ calendar_import_url: importUrl.trim() || null }).eq('id', profile.id)
    setSavingImportUrl(false)
    setImportUrlSaved(true)
    setTimeout(() => setImportUrlSaved(false), 2000)
  }

  const handleProfileImport = async (days: DayAvailability[], toDelete: string[]) => {
    const supabase = createClient()
    if (days.length > 0) {
      await supabase.from('availability').upsert(
        days.map(d => ({ user_id: profile.id, date: d.date, status: d.status!, from_time: d.from_time, until_time: d.until_time })),
        { onConflict: 'user_id,date' }
      )
    }
    if (toDelete.length > 0) {
      await supabase.from('availability').delete().eq('user_id', profile.id).in('date', toDelete)
    }
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

          {/* BGG-Sammlung synchronisieren */}
          {(profile.bgg_username || bggUsername.trim()) && (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">BGG-Sammlung</span>
                <span className="text-xs text-muted-foreground">
                  {syncedCount !== null
                    ? `${syncedCount} Spiele geladen`
                    : bggCollectionCount > 0
                    ? `${bggCollectionCount} Spiele gecacht`
                    : 'Noch nicht synchronisiert'}
                </span>
              </div>
              {syncError && <p className="text-xs text-destructive">{syncError}</p>}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSyncCollection}
                disabled={syncingCollection || !bggUsername.trim()}
              >
                {syncingCollection ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Wird geladen…</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Sammlung synchronisieren</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">Lädt deine aktuellen BGG-Spiele und speichert sie lokal.</p>
            </div>
          )}
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

      {/* Standard-Uhrzeiten */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standard-Uhrzeiten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Beim ersten Antippen eines Tages werden automatisch diese Zeiten eingetragen.
            Gesetzliche Feiertage (national) werden erkannt.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="timesEnabled"
              checked={timesEnabled}
              onChange={(e) => setTimesEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="timesEnabled" className="cursor-pointer">Standard-Uhrzeiten aktivieren</Label>
          </div>
          {timesEnabled && (
            <div className="space-y-4">
              {([
                { label: 'Werktag', sub: 'Mo–Do', key: 'workday', val: workday, set: setWorkday },
                { label: 'Freitagsgefühl', sub: 'Fr + Tag vor Feiertag', key: 'pre_free', val: preFree, set: setPreFree },
                { label: 'Freier Tag', sub: 'Sa, So, Feiertage', key: 'free_day', val: freeDay, set: setFreeDay },
              ] as const).map(({ label, sub, val, set }) => (
                <div key={label} className="space-y-1.5">
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{sub}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Von</Label>
                      <input
                        type="time"
                        value={val.start}
                        onChange={(e) => set((prev) => ({ ...prev, start: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Bis</Label>
                      <input
                        type="time"
                        value={val.end}
                        onChange={(e) => set((prev) => ({ ...prev, end: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={handleSaveTimes}
            disabled={savingTimes}
            size="sm"
            className="w-full"
          >
            {savingTimes ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : timesSaved ? (
              <><Check className="h-4 w-4 mr-1" /> Gespeichert</>
            ) : (
              'Speichern'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Kalender-Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Kalender-Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Export: Webcal-Abo */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Termine abonnieren</p>
            <p className="text-xs text-muted-foreground">
              Füge diesen Link in deiner Kalender-App ein, um deine bestätigten Termine automatisch zu synchronisieren.
              Der Kalender aktualisiert sich regelmäßig von selbst.
            </p>
            <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground break-all">
              webcal://…/api/calendar/{calendarToken.slice(0, 8)}…/events.ics
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleCopyWebcal}>
              {copied
                ? <><Check className="h-4 w-4 mr-2 text-green-500" />Link kopiert!</>
                : <><Copy className="h-4 w-4 mr-2" />webcal-Link kopieren</>
              }
            </Button>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p><strong>Google:</strong> Andere Kalender → Per URL → Link einfügen</p>
              <p><strong>Apple:</strong> Datei → Neues Kalenderabonnement → URL einfügen</p>
              <p><strong>Outlook:</strong> Kalender hinzufügen → Aus dem Internet → URL einfügen</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-sm font-medium">Kalender importieren</p>
            <p className="text-xs text-muted-foreground">
              Speichere eine ICS-URL deines Kalenders, um Verfügbarkeiten per Knopfdruck neu zu importieren.
            </p>
            <div className="space-y-1">
              <Label htmlFor="importUrl" className="text-xs">ICS-/webcal-URL (optional)</Label>
              <Input
                id="importUrl"
                placeholder="https://… oder webcal://…"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSaveImportUrl}
                disabled={savingImportUrl}
              >
                {savingImportUrl
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : importUrlSaved
                    ? <><Check className="h-4 w-4 mr-1 text-green-500" />Gespeichert</>
                    : 'URL speichern'
                }
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!importUrl.trim()}
                onClick={() => setImportOpen(true)}
              >
                <CalendarDays className="h-4 w-4 mr-2" /> Jetzt importieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abmelden */}
      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Abmelden
      </Button>

      <CalendarImport
        open={importOpen}
        onOpenChange={setImportOpen}
        startDate={(() => {
          const today = new Date()
          const dow = today.getDay()
          const diff = dow === 0 ? -6 : 1 - dow
          const mon = new Date(today)
          mon.setDate(today.getDate() + diff)
          return mon.toISOString().split('T')[0]
        })()}
        todayStr={new Date().toISOString().split('T')[0]}
        existingAvailability={[]}
        defaultFromTime={null}
        defaultUntilTime={null}
        onImport={handleProfileImport}
      />
    </div>
  )
}
