'use client'

import { useState, useRef } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { parseICSEvents, BusyEvent } from '@/lib/ics'
import { DayAvailability } from '@/components/AvailabilityCalendar'
import { DefaultTimes, getTimesForDate } from '@/lib/holidays'
import { Upload, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: string          // Montag der aktuellen Woche (yyyy-MM-dd)
  todayStr: string
  existingAvailability: DayAvailability[]
  initialUrl?: string | null
  defaultTimes?: DefaultTimes | null
  onImport: (days: DayAvailability[], toDelete: string[]) => Promise<void>
}

type Tab = 'file' | 'url'
type DayState = 'green' | 'yellow' | 'red' | 'violet' | 'dark_green' | 'orange'
type FilterMode = 'alle' | 'alles' | 'nichts'
type OverlapType = 'none' | 'front' | 'back' | 'full'

interface PreviewDay {
  date: string
  label: string
  icsEvent: BusyEvent | null
  overlapType: OverlapType
  adjustedStart: string | null  // for 'front' overlap
  adjustedEnd: string | null    // for 'back' overlap
  state: DayState
  selected: boolean
  hadEntry: boolean
}

const STATE_STYLE: Record<DayState, { dot: string; label: string }> = {
  green:      { dot: 'bg-green-500',  label: 'verfügbar' },
  yellow:     { dot: 'bg-yellow-400', label: 'unklar' },
  red:        { dot: 'bg-red-500',    label: 'nicht verfügbar' },
  violet:     { dot: 'bg-purple-500', label: 'Termin (nicht verfügbar)' },
  dark_green: { dot: 'bg-green-800',  label: 'verfügbar (nach Termin)' },
  orange:     { dot: 'bg-orange-500', label: 'unklar (nach Termin)' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMin(hhmm: string): number {
  const [h, m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}
function fromMin(min: number): string {
  const c = Math.max(0, Math.min(min, 23 * 60 + 59))
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`
}

function detectOverlap(event: BusyEvent, defStart: string, defEnd: string): {
  type: OverlapType; adjustedStart: string | null; adjustedEnd: string | null
} {
  if (event.allDay || !event.startTime || !event.endTime)
    return { type: 'full', adjustedStart: null, adjustedEnd: null }
  const evS = toMin(event.startTime), evE = toMin(event.endTime)
  const defS = toMin(defStart), defE = toMin(defEnd)
  if (evE <= defS || evS >= defE)         return { type: 'none', adjustedStart: null, adjustedEnd: null }
  if (evS <= defS && evE >= defE)         return { type: 'full', adjustedStart: null, adjustedEnd: null }
  if (evS >= defS && evE <= defE)         return { type: 'full', adjustedStart: null, adjustedEnd: null } // inside window
  if (evS < defS)                         return { type: 'front', adjustedStart: fromMin(evE + 60), adjustedEnd: null }
  return                                         { type: 'back',  adjustedStart: null, adjustedEnd: fromMin(evS - 60) }
}

function initialState(event: BusyEvent | null, overlap: OverlapType): DayState {
  if (!event) return 'green'
  if (overlap === 'full') return 'red'
  if (overlap === 'none') return 'yellow'
  return 'violet'
}

function cycleState(cur: DayState, overlap: OverlapType): DayState {
  if (overlap === 'front' || overlap === 'back') {
    const c: DayState[] = ['violet', 'dark_green', 'orange']
    return c[(c.indexOf(cur) + 1) % 3]
  }
  const c: DayState[] = ['green', 'yellow', 'red']
  return c[(c.indexOf(cur) + 1) % 3]
}

function applyFilter(days: PreviewDay[], mode: FilterMode): PreviewDay[] {
  return days.map(d => ({
    ...d,
    selected: mode === 'alles' ? true
      : mode === 'nichts' ? false
      : d.icsEvent !== null && d.hadEntry,   // 'alle': only ICS-busy + had app entry
  }))
}


export default function CalendarImport({
  open, onOpenChange, startDate, todayStr, existingAvailability, initialUrl, defaultTimes, onImport,
}: Props) {
  const [tab, setTab] = useState<Tab>(() => initialUrl ? 'url' : 'file')
  const [url, setUrl] = useState(initialUrl ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewDay[] | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('alle')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPreview(null)
    setError(null)
    setLoading(false)
    setSaving(false)
    setUrl(initialUrl ?? '')
    setTab(initialUrl ? 'url' : 'file')
  }

  const buildPreview = (icsText: string) => {
    const events = parseICSEvents(icsText)
    const eventsByDate = new Map(events.map(e => [e.date, e]))
    const weekStart = parseISO(startDate)
    const today = parseISO(todayStr)
    const days = Array.from({ length: 35 }, (_, i) => addDays(weekStart, i)).filter(d => d >= today)
    const appIsEmpty = existingAvailability.length === 0
    const result: PreviewDay[] = []

    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const icsEvent = eventsByDate.get(dateStr) ?? null
      const hadEntry = existingAvailability.some(a => a.date === dateStr)
      if (!icsEvent && hadEntry) continue  // ICS free + already has entry → nothing to do

      const defTimes = defaultTimes ? getTimesForDate(day, defaultTimes) : null
      let overlapType: OverlapType = 'none'
      let adjustedStart: string | null = null, adjustedEnd: string | null = null

      if (icsEvent && defTimes) {
        const ol = detectOverlap(icsEvent, defTimes.start, defTimes.end)
        overlapType = ol.type; adjustedStart = ol.adjustedStart; adjustedEnd = ol.adjustedEnd
      } else if (icsEvent) {
        overlapType = icsEvent.allDay ? 'full' : 'none'
      }

      result.push({
        date: dateStr,
        label: format(day, 'EE, d. MMM', { locale: de }),
        icsEvent, overlapType, adjustedStart, adjustedEnd,
        state: initialState(icsEvent, overlapType),
        selected: false, hadEntry,
      })
    }

    const mode: FilterMode = appIsEmpty ? 'alles' : 'alle'
    setPreview(applyFilter(result, mode))
    setFilterMode(mode)
  }

  const handleFile = async (file: File) => {
    setError(null); setLoading(true)
    try {
      const text = await file.text()
      if (!text.includes('BEGIN:VCALENDAR')) { setError('Keine gültige ICS-Datei.'); return }
      buildPreview(text)
    } catch { setError('Datei konnte nicht gelesen werden.') }
    finally { setLoading(false) }
  }

  const handleUrl = async () => {
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) { setError(`Fehler: ${await res.text()}`); return }
      buildPreview(await res.text())
    } catch { setError('URL konnte nicht abgerufen werden.') }
    finally { setLoading(false) }
  }

  const handleFilterMode = (mode: FilterMode) => {
    setFilterMode(mode)
    setPreview(prev => prev ? applyFilter(prev, mode) : null)
  }

  const cycleDay = (date: string) =>
    setPreview(prev => prev?.map(d =>
      d.date === date ? { ...d, state: cycleState(d.state, d.overlapType) } : d
    ) ?? null)

  const toggleSelected = (date: string) =>
    setPreview(prev => prev?.map(d =>
      d.date === date ? { ...d, selected: !d.selected } : d
    ) ?? null)

  const handleConfirm = async () => {
    if (!preview) return
    setSaving(true)
    const toSave: DayAvailability[] = []
    const toDelete: string[] = []

    for (const day of preview) {
      if (!day.selected) continue
      const date = parseISO(day.date)
      const dt = defaultTimes ? getTimesForDate(date, defaultTimes) : null
      if (day.state === 'green') {
        toSave.push({ date: day.date, status: 'available', from_time: dt?.start ?? null, until_time: dt?.end ?? null })
      } else if (day.state === 'yellow') {
        toSave.push({ date: day.date, status: 'uncertain', from_time: dt?.start ?? null, until_time: dt?.end ?? null })
      } else if (day.state === 'dark_green') {
        toSave.push({ date: day.date, status: 'available', from_time: day.adjustedStart ?? dt?.start ?? null, until_time: day.adjustedEnd ?? dt?.end ?? null })
      } else if (day.state === 'orange') {
        toSave.push({ date: day.date, status: 'uncertain', from_time: day.adjustedStart ?? dt?.start ?? null, until_time: day.adjustedEnd ?? dt?.end ?? null })
      } else if ((day.state === 'red' || day.state === 'violet') && day.hadEntry) {
        toDelete.push(day.date)
      }
    }

    await onImport(toSave, toDelete)
    setSaving(false); onOpenChange(false); reset()
  }

  const selected = preview?.filter(d => d.selected) ?? []
  const addCount    = selected.filter(d => ['green', 'yellow', 'dark_green', 'orange'].includes(d.state)).length
  const removeCount = selected.filter(d => ['red', 'violet'].includes(d.state) && d.hadEntry).length

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
                <Input
                  placeholder="https://… oder webcal://…"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
                <Button className="w-full" onClick={handleUrl} disabled={loading || !url.trim()}>
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
            {/* Filter buttons */}
            <div className="flex gap-2">
              {(['alle', 'alles', 'nichts'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleFilterMode(mode)}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                    filterMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {mode === 'alle' ? 'Alle Termine' : mode === 'alles' ? 'Alles übernehmen' : 'Nichts'}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
              {addCount > 0 && <p><span className="font-medium text-green-700">+{addCount} Tage</span> werden eingetragen</p>}
              {removeCount > 0 && <p><span className="font-medium text-red-600">−{removeCount} Tage</span> werden entfernt</p>}
              {addCount === 0 && removeCount === 0 && <p className="text-muted-foreground">Keine Änderungen ausgewählt.</p>}
            </div>

            {/* Day list */}
            {preview.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {preview.map(d => (
                  <div key={d.date} className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    d.selected ? 'bg-background border-border' : 'bg-muted/40 border-border/50 opacity-60'
                  )}>
                    <input
                      type="checkbox"
                      checked={d.selected}
                      onChange={() => toggleSelected(d.date)}
                      className="rounded shrink-0"
                    />
                    <span className="flex-1 text-foreground">{d.label}</span>
                    <button
                      onClick={() => cycleDay(d.date)}
                      title={STATE_STYLE[d.state].label}
                      className={cn('w-5 h-5 rounded-full shrink-0 transition-colors', STATE_STYLE[d.state].dot)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine relevanten Tage gefunden.</p>
            )}

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(Object.entries(STATE_STYLE) as [DayState, { dot: string; label: string }][]).map(([, s]) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={cn('w-3 h-3 rounded-full shrink-0', s.dot)} />
                  {s.label}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">Tippe auf den Farbkreis, um den Status zu wechseln.</p>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset}>Zurück</Button>
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

