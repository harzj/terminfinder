'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2, LogOut, RefreshCw, CalendarDays, Copy, Plus, Minus, Bell, BellOff, ChevronDown } from 'lucide-react'
import CalendarImport from '@/components/CalendarImport'
import { DayAvailability } from '@/components/AvailabilityCalendar'
import { DefaultTimes } from '@/lib/holidays'

function parseImportUrls(raw: string | null): string[] {
  const items = (raw ?? '')
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
  return items.length > 0 ? items : ['']
}

function serializeImportUrls(urls: string[]): string | null {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned.join('\n') : null
}

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
  startDate: string
  todayStr: string
  initialAvailability: DayAvailability[]
}

export default function ProfilClient({ profile, email, memberships, bggCollectionCount, defaultTimes, calendarToken, calendarImportUrl: initialImportUrl, startDate, todayStr, initialAvailability }: Props) {
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bggUsername, setBggUsername] = useState(profile.bgg_username ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [syncingCollection, setSyncingCollection] = useState(false)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Default availability times (4 fields)
  const isNewFmt = defaultTimes && 'start_frei' in defaultTimes
  const [startFrei, setStartFrei] = useState(isNewFmt ? defaultTimes!.start_frei : '10:00')
  const [startWerktag, setStartWerktag] = useState(isNewFmt ? defaultTimes!.start_werktag : '18:00')
  const [endeNextWorkday, setEndeNextWorkday] = useState(isNewFmt ? defaultTimes!.ende_next_workday : '22:00')
  const [endeNextFree, setEndeNextFree] = useState(isNewFmt ? defaultTimes!.ende_next_free : '23:30')
  const [timesEnabled, setTimesEnabled] = useState(defaultTimes !== null)
  const [timesOpen, setTimesOpen] = useState(false)
  const [savingTimes, setSavingTimes] = useState(false)
  const [timesSaved, setTimesSaved] = useState(false)

  const [groupNames, setGroupNames] = useState<Record<string, string>>(
    Object.fromEntries(memberships.map((m) => [m.id, m.display_name ?? '']))
  )
  const [groupNamesOpen, setGroupNamesOpen] = useState(false)
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [savedGroup, setSavedGroup] = useState<string | null>(null)

  // Calendar integration
  const [importUrls, setImportUrls] = useState<string[]>(() => parseImportUrls(initialImportUrl))
  const [savingImportUrl, setSavingImportUrl] = useState(false)
  const [importUrlSaved, setImportUrlSaved] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importInitialUrl, setImportInitialUrl] = useState<string | null>(null)
  const [autoLoadImportUrl, setAutoLoadImportUrl] = useState(false)
  const [copied, setCopied] = useState(false)

  const [notifStatus, setNotifStatus] = useState<'idle' | 'requesting' | 'done' | 'denied' | 'error'>('idle')
  const [notifError, setNotifError] = useState<string | null>(null)
  const [disableStatus, setDisableStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleEnableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifError('Dein Browser unterstützt keine Push-Benachrichtigungen.')
      setNotifStatus('error')
      return
    }
    setNotifStatus('requesting')
    setNotifError(null)
    try {
      // 1. Permission zuerst – zeigt den Browser-Dialog sofort
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus('denied')
        return
      }
      // 2. SW registrieren und auf Aktivierung warten
      await navigator.serviceWorker.register('/service-worker.js')
      const registration = await navigator.serviceWorker.ready
      // 3. Push-Subscription anlegen
      const vapidRes = await fetch('/api/push/vapid-key')
      if (!vapidRes.ok) {
        const body = await vapidRes.text().catch(() => '')
        throw new Error(`VAPID key nicht verfügbar (${vapidRes.status}${body ? ': ' + body : ''})`)
      }
      const vapidJson = await vapidRes.json()
      const vapidKey: string = vapidJson.key
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = atob(base64)
      const applicationServerKey = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; i++) { applicationServerKey[i] = rawData.charCodeAt(i) }
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) throw new Error(`Server: ${res.status}`)
      setNotifStatus('done')
      setTimeout(() => setNotifStatus('idle'), 3000)
    } catch (err) {
      console.error('Push-Subscription fehlgeschlagen:', err)
      setNotifError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setNotifStatus('error')
    }
  }

  const handleDisableNotifications = async () => {
    if (disableStatus === 'loading') return
    setDisableStatus('loading')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }
      setDisableStatus('done')
      setTimeout(() => setDisableStatus('idle'), 2500)
    } catch {
      setDisableStatus('idle')
    }
  }

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
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('tf_logged_in')
    }
    router.push('/anmelden')
  }

  const handleSaveTimes = async () => {
    setSavingTimes(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({
        default_availability_times: timesEnabled
          ? { start_frei: startFrei, start_werktag: startWerktag, ende_next_workday: endeNextWorkday, ende_next_free: endeNextFree }
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
    const webcalUrl = `webcal://${host}/api/calendar/${calendarToken}`
    navigator.clipboard.writeText(webcalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSaveImportUrl = async () => {
    setSavingImportUrl(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ calendar_import_url: serializeImportUrls(importUrls) })
      .eq('id', profile.id)
    setSavingImportUrl(false)
    setImportUrlSaved(true)
    setTimeout(() => setImportUrlSaved(false), 2000)
  }

  const updateImportUrl = (index: number, value: string) => {
    setImportUrlSaved(false)
    setImportUrls((prev) => prev.map((url, i) => (i === index ? value : url)))
  }

  const addImportUrl = () => {
    setImportUrlSaved(false)
    setImportUrls((prev) => [...prev, ''])
  }

  const openImportForUrl = (rawUrl?: string, autoLoad = false) => {
    const selected = rawUrl?.trim() || importUrls.find((u) => u.trim())?.trim() || null
    setImportInitialUrl(selected)
    setAutoLoadImportUrl(autoLoad && !!selected)
    setImportOpen(true)
  }

  const removeImportUrl = (index: number) => {
    setImportUrlSaved(false)
    setImportUrls((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : ['']
    })
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
          <CardHeader
            className="cursor-pointer select-none py-3"
            onClick={() => setGroupNamesOpen((v) => !v)}
          >
            <CardTitle className="text-base flex items-center justify-between">
              Name pro Gruppe
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${groupNamesOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
          {groupNamesOpen && (
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
          )}
        </Card>
      )}

      {/* Standard-Uhrzeiten */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none py-3"
          onClick={() => setTimesOpen((v) => !v)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            Standard-Uhrzeiten
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${timesOpen ? 'rotate-180' : ''}`} />
          </CardTitle>
        </CardHeader>
        {timesOpen && (
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
            <div className="space-y-3">
              {([
                { label: 'Start, wenn frei', sub: 'Sa, So, Feiertage', val: startFrei, set: setStartFrei },
                { label: 'Start an Werktag', sub: 'Mo–Fr', val: startWerktag, set: setStartWerktag },
                { label: 'Ende, wenn nächster Tag Werktag', sub: 'Mo–Do, So', val: endeNextWorkday, set: setEndeNextWorkday },
                { label: 'Ende, wenn nächster Tag frei', sub: 'Fr, Sa, Tag vor Feiertag', val: endeNextFree, set: setEndeNextFree },
              ] as const).map(({ label, sub, val, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <input
                    type="time"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm shrink-0"
                  />
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
        )}
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
            <div className="space-y-2">
              <Label className="text-xs">ICS-/webcal-URLs (optional)</Label>
              {importUrls.map((urlValue, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    id={`importUrl-${index}`}
                    placeholder="https://… oder webcal://…"
                    value={urlValue}
                    onChange={e => updateImportUrl(index, e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => openImportForUrl(urlValue, true)}
                    disabled={!urlValue.trim()}
                    aria-label={`Kalender ${index + 1} synchronisieren`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeImportUrl(index)}
                    disabled={importUrls.length === 1}
                    aria-label={`URL ${index + 1} entfernen`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={addImportUrl}
                aria-label="Weitere URL hinzufügen"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
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
                disabled={!importUrls.some((u) => u.trim())}
                onClick={() => openImportForUrl(undefined, false)}
              >
                <CalendarDays className="h-4 w-4 mr-2" /> Jetzt importieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benachrichtigungen */}
      <div className="flex gap-2">
      <Button
        variant="outline"
        className="flex-1"
        onClick={handleEnableNotifications}
        disabled={notifStatus === 'requesting'}
      >
        {notifStatus === 'requesting' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : notifStatus === 'done' ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Bell className="h-4 w-4 mr-2" />
        )}
        {notifStatus === 'done'
          ? 'Benachrichtigungen aktiviert'
          : notifStatus === 'denied'
          ? 'Benachrichtigungen blockiert – in Browser-Einstellungen erlauben'
          : notifStatus === 'error'
          ? 'Fehler – erneut versuchen'
          : 'Benachrichtigungen aktivieren'}
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        onClick={handleDisableNotifications}
        disabled={disableStatus === 'loading'}
      >
        {disableStatus === 'loading' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : disableStatus === 'done' ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <BellOff className="h-4 w-4 mr-2" />
        )}
        {disableStatus === 'done' ? 'Deaktiviert' : 'Benachrichtigungen aus'}
      </Button>
      </div>
      {(notifStatus === 'error' || notifStatus === 'denied') && notifError && (
        <p className="text-xs text-destructive -mt-2">{notifError}</p>
      )}

      {/* Abmelden */}
      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Abmelden
      </Button>

      <CalendarImport
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) {
            setImportInitialUrl(null)
            setAutoLoadImportUrl(false)
          }
        }}
        startDate={startDate}
        todayStr={todayStr}
        existingAvailability={initialAvailability}
        initialUrl={importInitialUrl}
        initialUrls={importUrls}
        autoLoadInitialUrl={autoLoadImportUrl}
        defaultTimes={timesEnabled ? { start_frei: startFrei, start_werktag: startWerktag, ende_next_workday: endeNextWorkday, ende_next_free: endeNextFree } : null}
        onImport={handleProfileImport}
      />
    </div>
  )
}
