'use client'

import { useState, useTransition } from 'react'
import AvailabilityCalendar, { DayAvailability, ConfirmedEvent } from '@/components/AvailabilityCalendar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  startDate: string
  initialAvailability: DayAvailability[]
  confirmedEvents: ConfirmedEvent[]
}

export default function VerfuegbarkeitClient({ userId, startDate, initialAvailability, confirmedEvents }: Props) {
  const [availability, setAvailability] = useState<DayAvailability[]>(initialAvailability)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()

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

  return (
    <>
      {saveError && (
        <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}
      <AvailabilityCalendar
      startDate={startDate}
      availability={availability}
      confirmedEvents={confirmedEvents}
      onSave={handleSave}
      onDelete={handleDelete}
    />
    </>
  )
}
