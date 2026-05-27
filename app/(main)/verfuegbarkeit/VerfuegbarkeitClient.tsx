'use client'

import { useEffect, useMemo, useState } from 'react'
import AvailabilityCalendar, { DayAvailability, ConfirmedEvent } from '@/components/AvailabilityCalendar'
import CalendarImport from '@/components/CalendarImport'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DefaultTimes } from '@/lib/holidays'
import { Button } from '@/components/ui/button'
import { CalendarDays, Lock, LockOpen } from 'lucide-react'

function parseImportUrls(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
}

interface Props {
  userId: string
  startDate: string   // Montag der aktuellen Woche
  todayStr: string    // heutiges Datum
  initialAvailability: DayAvailability[]
  confirmedEvents: ConfirmedEvent[]
  defaultTimes?: DefaultTimes | null
  calendarImportUrl?: string | null
}

export default function VerfuegbarkeitClient({ userId, startDate, todayStr, initialAvailability, confirmedEvents, defaultTimes, calendarImportUrl }: Props) {
  const [availability, setAvailability] = useState<DayAvailability[]>(initialAvailability)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedImportUrl, setSelectedImportUrl] = useState<string | null>(null)
  const [autoLoadSelectedUrl, setAutoLoadSelectedUrl] = useState(false)
  const [locked, setLocked] = useState(false)
  const importUrls = parseImportUrls(calendarImportUrl)
  const lockStorageKey = useMemo(() => `availability_locked:${userId}`, [userId])

  useEffect(() => {
    const saved = localStorage.getItem(lockStorageKey)
    setLocked(saved === '1')
  }, [lockStorageKey])

  const toggleLocked = () => {
    setLocked((prev) => {
      const next = !prev
      localStorage.setItem(lockStorageKey, next ? '1' : '0')
      return next
    })
  }

  const markUserChanged = async (supabase: ReturnType<typeof createClient>, dates: string[]) => {
    const now = new Date().toISOString()
    await supabase.from('calendar_sync_state').upsert(
      dates.map(date => ({ user_id: userId, date, user_changed_at: now })),
      { onConflict: 'user_id,date' }
    )
  }

  const handleSave = async (day: DayAvailability) => {
    setSaveError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('availability')
      .upsert(
        { user_id: userId, date: day.date, status: day.status!, from_time: day.from_time, until_time: day.until_time },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()

    if (!error && data) {
      setAvailability((prev) => {
        const next = prev.filter((a) => a.date !== day.date)
        return [...next, { date: data.date, status: data.status, from_time: data.from_time, until_time: data.until_time }]
      })
      markUserChanged(supabase, [day.date])
    } else if (error) {
      setSaveError(`Speichern fehlgeschlagen: ${error.message} (Code: ${error.code})`)
    }
  }

  const handleDelete = async (date: string) => {
    const supabase = createClient()
    await supabase.from('availability').delete().eq('user_id', userId).eq('date', date)
    setAvailability((prev) => prev.filter((a) => a.date !== date))
    markUserChanged(supabase, [date])
  }

  const handleImport = async (days: DayAvailability[], toDelete: string[]) => {
    const supabase = createClient()

    // Save new availability entries in parallel
    if (days.length > 0) {
      await supabase.from('availability').upsert(
        days.map(d => ({ user_id: userId, date: d.date, status: d.status!, from_time: d.from_time, until_time: d.until_time })),
        { onConflict: 'user_id,date' }
      )
    }

    // Delete removed entries
    if (toDelete.length > 0) {
      await supabase.from('availability').delete().eq('user_id', userId).in('date', toDelete)
    }

    // Mark all changed dates as user-initiated (auto-sync won't override until ICS changes)
    const allDates = [...days.map(d => d.date), ...toDelete]
    if (allDates.length > 0) markUserChanged(supabase, allDates)

    // Refresh local state
    const { data: fresh } = await supabase
      .from('availability')
      .select('date, status, from_time, until_time')
      .eq('user_id', userId)
    setAvailability(fresh ?? [])
  }

  return (
    <>
      {saveError && (
        <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Meine Verfügbarkeit</h2>
          <button
            type="button"
            onClick={toggleLocked}
            aria-label={locked ? 'Verfügbarkeit entsperren' : 'Verfügbarkeit sperren'}
            title={locked ? 'Verfügbarkeit entsperren' : 'Verfügbarkeit sperren'}
            className={locked
              ? 'inline-flex h-6 w-6 items-center justify-center rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
              : 'inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Tippe auf einen Tag, um deine Verfügbarkeit einzutragen.
          {locked && ' (gesperrt)'}
        </p>
      </div>
      <AvailabilityCalendar
        startDate={startDate}
        todayStr={todayStr}
        availability={availability}
        confirmedEvents={confirmedEvents}
        onSave={handleSave}
        onDelete={handleDelete}
        defaultTimes={defaultTimes}
        locked={locked}
      />

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setSelectedImportUrl(importUrls[0] ?? null)
            setAutoLoadSelectedUrl(false)
            setImportOpen(true)
          }}
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Kalender importieren
        </Button>
      </div>

      <CalendarImport
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) {
            setSelectedImportUrl(null)
            setAutoLoadSelectedUrl(false)
          }
        }}
        startDate={startDate}
        todayStr={todayStr}
        existingAvailability={availability}
        initialUrl={selectedImportUrl}
        initialUrls={importUrls}
        autoLoadInitialUrl={autoLoadSelectedUrl}
        defaultTimes={defaultTimes}
        onImport={handleImport}
      />
    </>
  )
}
