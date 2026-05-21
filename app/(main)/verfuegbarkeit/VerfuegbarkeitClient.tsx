'use client'

import { useState } from 'react'
import AvailabilityCalendar, { DayAvailability, ConfirmedEvent } from '@/components/AvailabilityCalendar'
import CalendarImport from '@/components/CalendarImport'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DefaultTimes, getDayType } from '@/lib/holidays'
import { Button } from '@/components/ui/button'
import { CalendarDays } from 'lucide-react'

interface Props {
  userId: string
  startDate: string   // Montag der aktuellen Woche
  todayStr: string    // heutiges Datum
  initialAvailability: DayAvailability[]
  confirmedEvents: ConfirmedEvent[]
  defaultTimes?: DefaultTimes | null
}

export default function VerfuegbarkeitClient({ userId, startDate, todayStr, initialAvailability, confirmedEvents, defaultTimes }: Props) {
  const [availability, setAvailability] = useState<DayAvailability[]>(initialAvailability)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

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
    } else if (error) {
      setSaveError(`Speichern fehlgeschlagen: ${error.message} (Code: ${error.code})`)
    }
  }

  const handleDelete = async (date: string) => {
    const supabase = createClient()
    await supabase.from('availability').delete().eq('user_id', userId).eq('date', date)
    setAvailability((prev) => prev.filter((a) => a.date !== date))
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

    // Refresh local state
    const { data: fresh } = await supabase
      .from('availability')
      .select('date, status, from_time, until_time')
      .eq('user_id', userId)
    setAvailability(fresh ?? [])
  }

  // Determine default times for import (first available day type)
  const firstDefaultTimes = defaultTimes
    ? (defaultTimes.workday ?? defaultTimes.free_day ?? null)
    : null

  return (
    <>
      {saveError && (
        <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}
      <AvailabilityCalendar
        startDate={startDate}
        todayStr={todayStr}
        availability={availability}
        confirmedEvents={confirmedEvents}
        onSave={handleSave}
        onDelete={handleDelete}
        defaultTimes={defaultTimes}
      />

      <div className="mt-4">
        <Button variant="outline" size="sm" className="w-full" onClick={() => setImportOpen(true)}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Kalender importieren
        </Button>
      </div>

      <CalendarImport
        open={importOpen}
        onOpenChange={setImportOpen}
        startDate={startDate}
        todayStr={todayStr}
        existingAvailability={availability}
        defaultFromTime={firstDefaultTimes?.start ?? null}
        defaultUntilTime={firstDefaultTimes?.end ?? null}
        onImport={handleImport}
      />
    </>
  )
}
