'use client'

import { useState, useRef } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { parseICS } from '@/lib/ics'
import { DayAvailability } from '@/components/AvailabilityCalendar'
import { Upload, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: string          // Montag der aktuellen Woche (yyyy-MM-dd)
  todayStr: string
  existingAvailability: DayAvailability[]
  defaultFromTime?: string | null
  defaultUntilTime?: string | null
  onImport: (days: DayAvailability[], toDelete: string[]) => Promise<void>
}

type Tab = 'file' | 'url'

interface PreviewDay {
  date: string
  label: string           // "Mo, 25. Mai"
  action: 'add' | 'remove' | 'keep'
  hadEntry: boolean
  included: boolean       // user toggle
}

export default function CalendarImport({
  open,
  onOpenChange,
  startDate,
  todayStr,
  existingAvailability,
  defaultFromTime,
  defaultUntilTime,
  onImport,
}: Props) {
  const [tab, setTab] = useState<Tab>('file')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewDay[] | null>(null)
  const [keepExisting, setKeepExisting] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPreview(null)
    setError(null)
    setLoading(false)
    setSaving(false)
    setUrl('')
  }

  const buildPreview = (icsText: string) => {
    const busyDates = new Set(parseICS(icsText))
    const weekStart = parseISO(startDate)
    const today = parseISO(todayStr)
    const days = Array.from({ length: 35 }, (_, i) => addDays(weekStart, i))
      .filter(d => d >= today)

    const result: PreviewDay[] = []

    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const label = format(day, 'EE, d. MMM', { locale: de })
      const hadEntry = existingAvailability.some(a => a.date === dateStr)
      const isBusy = busyDates.has(dateStr)

      if (!isBusy && !hadEntry) {
        // Free day → would add as available
        result.push({ date: dateStr, label, action: 'add', hadEntry, included: true })
      } else if (!isBusy && hadEntry) {
        // Free day, already has entry → keep (no change)
        result.push({ date: dateStr, label, action: 'keep', hadEntry, included: false })
      } else if (isBusy && hadEntry) {
        // Busy day, had entry → would remove
        result.push({ date: dateStr, label, action: 'remove', hadEntry, included: true })
      }
      // isBusy && !hadEntry → nothing to do, skip
    }

    setPreview(result)
  }

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const text = await file.text()
      if (!text.includes('BEGIN:VCALENDAR')) {
        setError('Die Datei scheint keine gültige ICS/iCal-Datei zu sein.')
        return
      }
      buildPreview(text)
    } catch {
      setError('Datei konnte nicht gelesen werden.')
    } finally {
      setLoading(false)
    }
  }

  const handleUrl = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError(`Fehler: ${msg}`)
        return
      }
      const text = await res.text()
      buildPreview(text)
    } catch {
      setError('URL konnte nicht abgerufen werden.')
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (date: string) => {
    setPreview(prev => prev?.map(d =>
      d.date === date ? { ...d, included: !d.included } : d
    ) ?? null)
  }

  // When keepExisting changes, recalculate 'remove' inclusions
  const handleKeepExisting = (val: boolean) => {
    setKeepExisting(val)
    setPreview(prev => prev?.map(d =>
      d.action === 'remove' ? { ...d, included: !val } : d
    ) ?? null)
  }

  const handleConfirm = async () => {
    if (!preview) return
    setSaving(true)

    const toSave: DayAvailability[] = preview
      .filter(d => d.included && d.action === 'add')
      .map(d => ({
        date: d.date,
        status: 'available' as const,
        from_time: defaultFromTime ?? null,
        until_time: defaultUntilTime ?? null,
      }))

    const toDelete: string[] = preview
      .filter(d => d.included && d.action === 'remove')
      .map(d => d.date)

    await onImport(toSave, toDelete)
    setSaving(false)
    onOpenChange(false)
    reset()
  }

  const addCount = preview?.filter(d => d.action === 'add' && d.included).length ?? 0
  const removeCount = preview?.filter(d => d.action === 'remove' && d.included).length ?? 0

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[90svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kalender importieren</SheetTitle>
        </SheetHeader>

        {!preview ? (
          <div className="mt-4 space-y-4">
            {/* Tab switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={cn('flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                  tab === 'file' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                onClick={() => setTab('file')}
              >
                <Upload className="h-4 w-4" /> Datei hochladen
              </button>
              <button
                className={cn('flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                  tab === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                onClick={() => setTab('url')}
              >
                <Link2 className="h-4 w-4" /> URL eingeben
              </button>
            </div>

            {tab === 'file' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Lade eine <strong>.ics</strong>-Datei hoch. Diese kannst du aus Google Calendar, Apple Kalender oder Outlook exportieren.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed flex-col gap-1"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-sm">{loading ? 'Wird gelesen…' : '.ics Datei auswählen'}</span>
                </Button>
              </div>
            )}

            {tab === 'url' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Gib eine ICS- oder webcal-URL ein. Diese findest du in deiner Kalender-App unter „Kalender teilen" oder „Abonnement-Link".
                </p>
                <div className="space-y-1">
                  <Label htmlFor="cal-url">Kalender-URL</Label>
                  <Input
                    id="cal-url"
                    placeholder="https://… oder webcal://…"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleUrl}
                  disabled={loading || !url.trim()}
                >
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird geladen…</> : 'Kalender laden'}
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
              <p><span className="text-green-600 font-medium">+{addCount} Tage</span> werden als verfügbar eingetragen</p>
              {removeCount > 0 && (
                <p><span className="text-red-500 font-medium">−{removeCount} Tage</span> werden entfernt (im Kalender belegt)</p>
              )}
              {addCount === 0 && removeCount === 0 && (
                <p className="text-muted-foreground">Keine Änderungen – dein Kalender ist bereits aktuell.</p>
              )}
            </div>

            {/* Options */}
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepExisting}
                onChange={e => handleKeepExisting(e.target.checked)}
                className="rounded"
              />
              Bestehende Einträge behalten (belegte Tage nicht löschen)
            </label>

            {/* Day list */}
            {preview.filter(d => d.action !== 'keep').length > 0 && (
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {preview
                  .filter(d => d.action !== 'keep')
                  .map(d => (
                    <button
                      key={d.date}
                      onClick={() => toggleDay(d.date)}
                      className={cn(
                        'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-colors',
                        d.included
                          ? d.action === 'add'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-muted/50 border-border text-muted-foreground line-through'
                      )}
                    >
                      <span>{d.label}</span>
                      <span className="text-xs font-medium">
                        {d.included
                          ? d.action === 'add' ? '+ verfügbar' : '− entfernen'
                          : 'übersprungen'}
                      </span>
                    </button>
                  ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Tippe auf einen Eintrag, um ihn ein-/auszuschließen.
            </p>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Zurück
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={saving || (addCount === 0 && removeCount === 0)}
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichern…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-2" />Übernehmen</>
                }
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
