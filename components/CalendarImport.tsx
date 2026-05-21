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
type DayState = 'green' | 'yellow' | 'red' | 'violet' | 'dark_green' | 'orange' | 'skip'
type FilterMode = 'alle' | 'alles' | 'nichts'
type OverlapType = 'none' | 'front' | 'back' | 'full'

interface PreviewDay {
  date: string
  label: string
  icsEvent: BusyEvent | null
  overlapType: OverlapType
  adjustedStart: string | null
  adjustedEnd: string | null
  baseState: DayState   // natural state from ICS
  state: DayState       // current state after filter + user cycles
  hadEntry: boolean
}

// Colored-oval border + bg + text
const STATE_STYLE: Record<DayState, string> = {
  green:      'border-green-500 bg-green-50 text-green-800',
  yellow:     'border-yellow-400 bg-yellow-50 text-yellow-800',
  red:        'border-red-500 bg-red-50 text-red-700',
  violet:     'border-purple-500 bg-purple-50 text-purple-800',
  dark_green: 'border-green-700 bg-green-100 text-green-900',
  orange:     'border-orange-500 bg-orange-50 text-orange-800',
  skip:       'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
}

const STATE_LABEL: Record<DayState, string> = {
  green:      'verfügbar',
  yellow:     'unklar',
  red:        'nicht verfügbar',
  violet:     'Termin – entfernen',
  dark_green: 'verfügbar (nach Termin)',
  orange:     'unklar (nach Termin)',
  skip:       'überspringen',
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

function cycleState(cur: DayState, hasIcsEvent: boolean, overlap: OverlapType): DayState {
  if (!hasIcsEvent) {
    // ICS-free opportunity: green → yellow → skip → green
    const c: DayState[] = ['green', 'yellow', 'skip']
    const i = c.indexOf(cur); return c[i === -1 ? 1 : (i + 1) % 3]
  }
  if (overlap === 'front' || overlap === 'back') {
    const c: DayState[] = ['violet', 'dark_green', 'orange', 'skip']
    const i = c.indexOf(cur); return c[i === -1 ? 1 : (i + 1) % 4]
  }
  if (overlap === 'full') {
    // ICS-busy conflict: red → green → yellow → skip → red
    const c: DayState[] = ['red', 'green', 'yellow', 'skip']
    const i = c.indexOf(cur); return c[i === -1 ? 1 : (i + 1) % 4]
  }
  // overlap === 'none': timed event, no overlap with window
  const c: DayState[] = ['yellow', 'red', 'green', 'skip']
  const i = c.indexOf(cur); return c[i === -1 ? 1 : (i + 1) % 4]
}

function applyFilter(days: PreviewDay[], mode: FilterMode): PreviewDay[] {
  return days.map(d => ({
    ...d,
    state: mode === 'nichts' ? 'skip'
      : mode === 'alle'
        ? (d.icsEvent ? d.baseState : 'skip')  // only ICS-busy conflicts
        : d.baseState,                          // 'alles': all deviations
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
    const result: PreviewDay[] = []

    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const icsEvent = eventsByDate.get(dateStr) ?? null
      const hadEntry = existingAvailability.some(a => a.date === dateStr)
      // Skip matches: ICS free + app has entry (both available), or ICS busy + no entry (both unavailable)
      if (!icsEvent && hadEntry) continue
      if (icsEvent && !hadEntry) continue

      const defTimes = defaultTimes ? getTimesForDate(day, defaultTimes) : null
      let overlapType: OverlapType = 'none'
      let adjustedStart: string | null = null, adjustedEnd: string | null = null

      if (icsEvent && defTimes) {
        const ol = detectOverlap(icsEvent, defTimes.start, defTimes.end)
        overlapType = ol.type; adjustedStart = ol.adjustedStart; adjustedEnd = ol.adjustedEnd
      } else if (icsEvent) {
        overlapType = icsEvent.allDay ? 'full' : 'none'
      }

      const base = initialState(icsEvent, overlapType)
      result.push({
        date: dateStr,
        label: format(day, 'EE, d. MMM', { locale: de }),
        icsEvent, overlapType, adjustedStart, adjustedEnd,
        baseState: base, state: base, hadEntry,
      })
    }

    const mode: FilterMode = 'alle'
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
      d.date === date ? { ...d, state: cycleState(d.state, d.icsEvent !== null, d.overlapType) } : d
    ) ?? null)

  const handleConfirm = async () => {
    if (!preview) return
    setSaving(true)
    const toSave: DayAvailability[] = []
    const toDelete: string[] = []

    for (const day of preview) {
      if (day.state === 'skip') continue
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

  const addCount    = (preview ?? []).filter(d => ['green', 'yellow', 'dark_green', 'orange'].includes(d.state)).length
  const removeCount = (preview ?? []).filter(d => ['red', 'violet'].includes(d.state) && d.hadEntry).length

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
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {preview.map(d => (
                  <button
                    key={d.date}
                    onClick={() => cycleDay(d.date)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors',
                      STATE_STYLE[d.state]
                    )}
                  >
                    <span>{d.label}</span>
                    <span className="text-xs opacity-70">{STATE_LABEL[d.state]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Abweichungen gefunden – alles stimmt überein.</p>
            )}

            <p className="text-xs text-muted-foreground">Tippe auf einen Eintrag, um den Status zu wechseln.</p>

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

