'use client'

import { format, addDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

interface Props {
  members: any[]
  availabilities: any[]
  events: any[]
  startDate: string
  endDate: string
  blockedDates?: string[]
  currentUserId?: string
}

const STATUS_CELL: Record<string, string> = {
  available: 'bg-green-500 text-white',
  uncertain: 'bg-yellow-400 text-black',
}

export default function GruppenUebersicht({ members, availabilities, events, startDate, endDate, blockedDates, currentUserId }: Props) {
  // Alle 28 Tage generieren
  const days: string[] = []
  const start = parseISO(startDate)
  for (let i = 0; i < 28; i++) {
    days.push(format(addDays(start, i), 'yyyy-MM-dd'))
  }

  // Confirmed Events pro Tag (dieser Gruppe)
  const confirmedDates = new Set(
    events.filter((e: any) => e.status === 'confirmed').map((e: any) => e.proposed_date)
  )

  // Blockierte Tage in anderen Gruppen (nur aktueller User)
  const blockedDateSet = new Set(blockedDates ?? [])

  // Availability-Index: user_id → date → {status, from_time, until_time}
  const availMap = new Map<string, Map<string, any>>()
  for (const a of availabilities) {
    if (!availMap.has(a.user_id)) availMap.set(a.user_id, new Map())
    availMap.get(a.user_id)!.set(a.date, a)
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div style={{ minWidth: `${Math.max(members.length * 48 + 80, 300)}px` }}>
        {/* Header: Tage */}
        <div className="grid mb-1" style={{ gridTemplateColumns: `80px repeat(${days.length}, 32px)` }}>
          <div />
          {days.map((d) => (
            <div key={d} className="text-center">
              <div className="text-[9px] text-muted-foreground leading-none">
                {format(parseISO(d), 'EE', { locale: de }).slice(0, 2)}
              </div>
              <div className="text-[11px] font-medium">
                {format(parseISO(d), 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Zeilen: Mitglieder */}
        {members.map((member: any) => {
          const dayMap = availMap.get(member.user_id) ?? new Map()
          const name = member.profiles?.display_name ?? member.email?.split('@')[0] ?? '?'

          return (
            <div
              key={member.user_id}
              className="grid items-center mb-1"
              style={{ gridTemplateColumns: `80px repeat(${days.length}, 32px)` }}
            >
              <div className="text-xs truncate pr-2 text-muted-foreground" title={name}>
                {name}
              </div>
              {days.map((d) => {
                const avail = dayMap.get(d)
                const isConfirmed = confirmedDates.has(d)
                const isBlockedOtherGroup = !isConfirmed && member.user_id === currentUserId && blockedDateSet.has(d)

                return (
                  <div
                    key={d}
                    className={cn(
                      'h-6 w-7 mx-auto rounded flex items-center justify-center',
                      isConfirmed
                        ? 'bg-blue-100'
                        : isBlockedOtherGroup
                          ? 'bg-purple-100'
                          : avail
                            ? STATUS_CELL[avail.status]
                            : 'bg-muted'
                    )}
                    title={isBlockedOtherGroup ? 'Termin in anderer Gruppe' : avail ? `${avail.status}${avail.from_time ? ` ${avail.from_time.slice(0,5)}–${avail.until_time?.slice(0,5) ?? ''}` : ''}` : 'keine Angabe'}
                  >
                    {isConfirmed && <Lock className="h-3 w-3 text-blue-600" />}
                    {isBlockedOtherGroup && <Lock className="h-3 w-3 text-purple-500" />}
                  </div>
                )
              })}
            </div>
          )
        })}
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
          <span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Bestätigt
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-100 inline-block" /> Andere Gruppe
        </span>
      </div>
    </div>
  )
}
