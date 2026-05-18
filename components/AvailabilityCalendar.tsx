'use client'

import { useState, useCallback } from 'react'
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export type AvailabilityStatus = 'available' | 'uncertain' | null

export interface DayAvailability {
  date: string
  status: AvailabilityStatus
  from_time: string | null
  until_time: string | null
}

export interface ConfirmedEvent {
  date: string
  group_name: string
}

interface AvailabilityCalendarProps {
  availability: DayAvailability[]
  confirmedEvents: ConfirmedEvent[]
  onSave: (day: DayAvailability) => Promise<void>
  onDelete: (date: string) => Promise<void>
}

const HOURS_DEFAULT = Array.from({ length: 10 }, (_, i) => i + 15) // 15–24
const HOURS_EXTENDED = Array.from({ length: 25 }, (_, i) => i) // 0–24
const HALF_HOURS_EXTENDED = Array.from({ length: 49 }, (_, i) => i * 30) // 0–24 in 30min

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}
function formatHalfHour(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-500 text-white',
  uncertain: 'bg-yellow-400 text-black',
}

export default function AvailabilityCalendar({
  availability,
  confirmedEvents,
  onSave,
  onDelete,
}: AvailabilityCalendarProps) {
  const today = startOfToday()
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i))

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editor-State
  const [status, setStatus] = useState<AvailabilityStatus>(null)
  const [fromTime, setFromTime] = useState<string | null>(null)
  const [untilTime, setUntilTime] = useState<string | null>(null)
  const [extendedHours, setExtendedHours] = useState(false)
  const [halfHours, setHalfHours] = useState(false)

  const getAvailability = useCallback(
    (date: Date): DayAvailability | undefined => {
      const dateStr = format(date, 'yyyy-MM-dd')
      return availability.find((a) => a.date === dateStr)
    },
    [availability]
  )

  const getConfirmedEvent = useCallback(
    (date: Date): ConfirmedEvent | undefined => {
      const dateStr = format(date, 'yyyy-MM-dd')
      return confirmedEvents.find((e) => e.date === dateStr)
    },
    [confirmedEvents]
  )

  const openSheet = (date: Date) => {
    const avail = getAvailability(date)
    setSelectedDate(date)
    setStatus(avail?.status ?? null)
    setFromTime(avail?.from_time ?? null)
    setUntilTime(avail?.until_time ?? null)
    setExtendedHours(false)
    setHalfHours(false)
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!selectedDate) return
    setSaving(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    if (status === null) {
      await onDelete(dateStr)
    } else {
      await onSave({ date: dateStr, status, from_time: fromTime, until_time: untilTime })
    }
    setSaving(false)
    setSheetOpen(false)
  }

  const timeOptions = halfHours
    ? HALF_HOURS_EXTENDED.map((m) => formatHalfHour(m))
    : extendedHours
      ? HOURS_EXTENDED.map(formatHour)
      : HOURS_DEFAULT.map(formatHour)

  // Kalender in Wochen aufteilen
  const weeks: Date[][] = []
  for (let i = 0; i < 28; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <>
      <div className="space-y-4">
        {weeks.map((week, wi) => (
          <div key={wi}>
            <div className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const avail = getAvailability(day)
                const event = getConfirmedEvent(day)
                const isToday = isSameDay(day, today)

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !event && openSheet(day)}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg p-1 aspect-square text-xs font-medium transition-all',
                      'border border-border',
                      isToday && 'ring-2 ring-primary ring-offset-1',
                      event
                        ? 'bg-blue-100 text-blue-800 cursor-default'
                        : avail?.status
                          ? STATUS_COLORS[avail.status]
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    <span className="text-[10px] leading-none">
                      {format(day, 'EE', { locale: de }).slice(0, 2)}
                    </span>
                    <span className="text-base leading-tight font-bold">
                      {format(day, 'd')}
                    </span>
                    {event ? (
                      <Lock className="h-3 w-3 mt-0.5" />
                    ) : avail?.from_time ? (
                      <span className="text-[9px] leading-none opacity-80">
                        {avail.from_time.slice(0, 5)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Kann
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Unklar
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted border border-border inline-block" /> Kann nicht
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Gesperrt
        </span>
      </div>

      {/* Bottom Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>
              {selectedDate &&
                format(selectedDate, 'EEEE, d. MMMM', { locale: de })}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* 3-Wege-Toggle */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStatus('available')}
                className={cn(
                  'rounded-xl p-3 text-sm font-medium border-2 transition-all',
                  status === 'available'
                    ? 'bg-green-500 text-white border-green-600'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                ✓ Kann
              </button>
              <button
                onClick={() => setStatus('uncertain')}
                className={cn(
                  'rounded-xl p-3 text-sm font-medium border-2 transition-all',
                  status === 'uncertain'
                    ? 'bg-yellow-400 text-black border-yellow-500'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                ? Unklar
              </button>
              <button
                onClick={() => setStatus(null)}
                className={cn(
                  'rounded-xl p-3 text-sm font-medium border-2 transition-all',
                  status === null
                    ? 'bg-red-100 text-red-700 border-red-300'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                ✗ Nein
              </button>
            </div>

            {/* Zeitauswahl (nur bei Kann oder Unklar) */}
            {status !== null && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Von</label>
                    <select
                      value={fromTime ?? ''}
                      onChange={(e) => setFromTime(e.target.value || null)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Beliebig</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t} Uhr</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Bis</label>
                    <select
                      value={untilTime ?? ''}
                      onChange={(e) => setUntilTime(e.target.value || null)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Beliebig</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t} Uhr</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Erweiterte Zeiten */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extendedHours}
                      onChange={(e) => {
                        setExtendedHours(e.target.checked)
                        if (!e.target.checked) setHalfHours(false)
                      }}
                      className="rounded"
                    />
                    Alle Uhrzeiten (0–24 Uhr)
                  </label>
                  {extendedHours && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={halfHours}
                        onChange={(e) => setHalfHours(e.target.checked)}
                        className="rounded"
                      />
                      Halbstunden anzeigen
                    </label>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
