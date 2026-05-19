'use client'

import { useState, useCallback, useRef } from 'react'
import { format, addDays, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { getDayType, DefaultTimes } from '@/lib/holidays'

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
  startDate: string   // Montag der aktuellen Woche
  todayStr: string    // heutiges Datum
  availability: DayAvailability[]
  confirmedEvents: ConfirmedEvent[]
  onSave: (day: DayAvailability) => Promise<void>
  onDelete: (date: string) => Promise<void>
  defaultTimes?: DefaultTimes | null
}

const HOURS_DEFAULT = Array.from({ length: 10 }, (_, i) => i + 15)
const HOURS_EXTENDED = Array.from({ length: 25 }, (_, i) => i)
const HALF_HOURS_EXTENDED = Array.from({ length: 49 }, (_, i) => i * 30)

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

const LONG_PRESS_MS = 500

export default function AvailabilityCalendar({
  startDate,
  todayStr,
  availability,
  confirmedEvents,
  onSave,
  onDelete,
  defaultTimes,
}: AvailabilityCalendarProps) {
  const weekStart = parseISO(startDate)   // Montag der aktuellen Woche
  const today = parseISO(todayStr)
  const days = Array.from({ length: 35 }, (_, i) => addDays(weekStart, i))

  const [sheetDate, setSheetDate] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fromTime, setFromTime] = useState<string | null>(null)
  const [untilTime, setUntilTime] = useState<string | null>(null)
  const [extendedHours, setExtendedHours] = useState(false)
  const [halfHours, setHalfHours] = useState(false)
  const [pendingDate, setPendingDate] = useState<string | null>(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  const getAvailability = useCallback(
    (date: Date) => availability.find((a) => a.date === format(date, 'yyyy-MM-dd')),
    [availability]
  )

  const getConfirmedEvent = useCallback(
    (date: Date) => confirmedEvents.find((e) => e.date === format(date, 'yyyy-MM-dd')),
    [confirmedEvents]
  )

  const openSheet = (date: Date) => {
    const avail = getAvailability(date)
    setSheetDate(date)
    setFromTime(avail?.from_time ?? null)
    setUntilTime(avail?.until_time ?? null)
    setExtendedHours(false)
    setHalfHours(false)
    setSheetOpen(true)
  }

  const isPastDay = (date: Date) => date < today

  const cycleTap = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (pendingDate === dateStr) return
    setPendingDate(dateStr)
    const avail = getAvailability(date)
    try {
      if (!avail) {
        let fromDefault: string | null = null
        let untilDefault: string | null = null
        if (defaultTimes) {
          const dayType = getDayType(date)
          const times = defaultTimes[dayType]
          if (times) {
            fromDefault = times.start
            untilDefault = times.end
          }
        }
        await onSave({ date: dateStr, status: 'available', from_time: fromDefault, until_time: untilDefault })
      } else if (avail.status === 'available') {
        await onSave({ date: dateStr, status: 'uncertain', from_time: avail.from_time, until_time: avail.until_time })
      } else {
        await onDelete(dateStr)
      }
    } finally {
      setPendingDate(null)
    }
  }

  const handlePointerDown = (date: Date, e: React.PointerEvent) => {
    if (getConfirmedEvent(date) || isPastDay(date)) return
    longPressFired.current = false
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      openSheet(date)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownPos.current || !longPressTimer.current) return
    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handlePointerUp = (date: Date) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!longPressFired.current) cycleTap(date)
    pointerDownPos.current = null
  }

  const handlePointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pointerDownPos.current = null
  }

  const handleSheetSave = async () => {
    if (!sheetDate) return
    setSaving(true)
    const dateStr = format(sheetDate, 'yyyy-MM-dd')
    const currentStatus = getAvailability(sheetDate)?.status ?? 'available'
    await onSave({ date: dateStr, status: currentStatus, from_time: fromTime, until_time: untilTime })
    setSaving(false)
    setSheetOpen(false)
  }

  const handleSheetDelete = async () => {
    if (!sheetDate) return
    setSaving(true)
    await onDelete(format(sheetDate, 'yyyy-MM-dd'))
    setSaving(false)
    setSheetOpen(false)
  }

  const timeOptions = halfHours
    ? HALF_HOURS_EXTENDED.map(formatHalfHour)
    : extendedHours
      ? HOURS_EXTENDED.map(formatHour)
      : HOURS_DEFAULT.map(formatHour)

  const weeks: Date[][] = []
  for (let i = 0; i < 35; i += 7) weeks.push(days.slice(i, i + 7))

  const sheetAvail = sheetDate ? getAvailability(sheetDate) : undefined

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
                const isPast = isPastDay(day)
                const dateStr = format(day, 'yyyy-MM-dd')
                const isPending = pendingDate === dateStr

                return (
                  <button
                    key={day.toISOString()}
                    disabled={!!event || isPending || isPast}
                    onPointerDown={(e) => handlePointerDown(day, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => handlePointerUp(day)}
                    onPointerCancel={handlePointerCancel}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg p-1 aspect-square text-xs font-medium transition-all select-none touch-none',
                      'border border-border',
                      isToday && 'ring-2 ring-primary ring-offset-1',
                      isPending && 'opacity-50',
                      isPast
                        ? 'bg-muted/40 text-muted-foreground/40 cursor-default border-border/50'
                        : event
                          ? 'bg-blue-100 text-blue-800 cursor-default'
                          : avail?.status
                            ? STATUS_COLORS[avail.status]
                            : 'bg-muted text-muted-foreground active:opacity-60'
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

      <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 1x Kann</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> 2x Unklar</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted border border-border inline-block" /> 3x Nein</span>
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Gebucht</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted/40 border border-border/50 inline-block" /> Vergangen</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Lang drücken → Uhrzeiten einstellen</p>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>
              {sheetDate && format(sheetDate, 'EEEE, d. MMMM', { locale: de })}
              {sheetAvail?.status === 'available' && <span className="ml-2 text-sm text-green-600 font-normal">Kann</span>}
              {sheetAvail?.status === 'uncertain' && <span className="ml-2 text-sm text-yellow-600 font-normal">Unklar</span>}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Von</label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={fromTime ?? ''}
                  onChange={(e) => setFromTime(e.target.value || null)}
                >
                  <option value="">Beliebig</option>
                  {timeOptions.map((t) => <option key={t} value={t}>{t} Uhr</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Bis</label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={untilTime ?? ''}
                  onChange={(e) => setUntilTime(e.target.value || null)}
                >
                  <option value="">Beliebig</option>
                  {timeOptions.map((t) => <option key={t} value={t}>{t} Uhr</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={extendedHours}
                  onChange={(e) => { setExtendedHours(e.target.checked); if (!e.target.checked) setHalfHours(false) }}
                  className="rounded" />
                0-24h
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={halfHours}
                  onChange={(e) => { setHalfHours(e.target.checked); setExtendedHours(true) }}
                  className="rounded" />
                Halbe Stunden
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSheetSave} disabled={saving} className="flex-1">
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
              {sheetAvail && (
                <Button variant="destructive" onClick={handleSheetDelete} disabled={saving}>
                  Löschen
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}