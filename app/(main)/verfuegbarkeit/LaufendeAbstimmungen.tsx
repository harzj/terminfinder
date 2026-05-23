'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Vote } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterMode = 'ausstehend' | 'aktive' | 'alle'

interface Props {
  events: any[]
  userId: string
  availability: { date: string; status: string }[]
}

const STORAGE_KEY = 'abstimmungenFilterMode'
const MODES: { key: FilterMode; label: string }[] = [
  { key: 'ausstehend', label: 'Ausstehend' },
  { key: 'aktive', label: 'Aktive' },
  { key: 'alle', label: 'Alle' },
]

export default function LaufendeAbstimmungen({ events, userId, availability }: Props) {
  const [mode, setMode] = useState<FilterMode>('ausstehend')

  // Restore saved preference after hydration
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as FilterMode | null
    if (saved && MODES.some(m => m.key === saved)) setMode(saved)
  }, [])

  const changeMode = (m: FilterMode) => {
    setMode(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  const availMap = new Map(availability.map(a => [a.date, a.status]))

  const filtered = events.filter((event: any) => {
    const myResponse = (event.event_responses ?? []).find((r: any) => r.user_id === userId)?.response
    const avail = availMap.get(event.proposed_date)
    if (mode === 'ausstehend') return myResponse == null || myResponse === 'uncertain'
    if (mode === 'aktive') return (avail === 'available' || avail === 'uncertain') && myResponse !== 'declined'
    return true
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" /> Laufende Abstimmungen
        </h2>
      </div>

      {/* Segmented control */}
      <div className="flex rounded-lg border border-border overflow-hidden mb-3 text-sm">
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => changeMode(key)}
            className={cn(
              'flex-1 py-1.5 text-center transition-colors',
              mode === key
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {mode === 'ausstehend' && 'Keine ausstehenden Abstimmungen.'}
          {mode === 'aktive' && 'Keine Abstimmungen für Tage, an denen du verfügbar bist.'}
          {mode === 'alle' && 'Keine laufenden Abstimmungen.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((event: any) => {
            const myResponse = (event.event_responses ?? []).find((r: any) => r.user_id === userId)?.response
            return (
              <Link key={event.id} href={`/gruppen/${event.group_id}?tab=abstimmungen`}>
                <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de })}
                    </p>
                    {event.from_time && (
                      <p className="text-xs text-muted-foreground">
                        {event.from_time.slice(0, 5)}{event.until_time ? ` – ${event.until_time.slice(0, 5)}` : ''} Uhr
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">{event.groups?.name ?? ''}</Badge>
                    {myResponse === 'accepted' && (
                      <span className="text-[10px] text-green-600 font-medium">Zugesagt</span>
                    )}
                    {myResponse === 'uncertain' && (
                      <span className="text-[10px] text-yellow-600 font-medium">Unklar</span>
                    )}
                    {myResponse === 'declined' && (
                      <span className="text-[10px] text-muted-foreground">Abgelehnt</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
