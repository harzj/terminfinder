'use client'

import { format, addDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'

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
  // Alle 35 Tage generieren (5 Wochen, synchron mit Verfügbarkeitskalender)
  const allDays: string[] = []
  const start = parseISO(startDate)
  for (let i = 0; i < 35; i++) {
    allDays.push(format(addDays(start, i), 'yyyy-MM-dd'))
  }

  // Vergangene Tage ausblenden
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = allDays.filter(d => d >= todayStr)

  // Confirmed Events pro Tag (dieser Gruppe) – nur für Mitglieder die zugesagt haben
  const confirmedByMember = new Map<string, Set<string>>()
  for (const event of events) {
    if (event.status !== 'confirmed') continue
    for (const r of (event.event_responses ?? [])) {
      if (r.response === 'accepted') {
        if (!confirmedByMember.has(r.user_id)) confirmedByMember.set(r.user_id, new Set())
        confirmedByMember.get(r.user_id)!.add(event.proposed_date)
      }
    }
  }

  // Blockierte Tage in anderen Gruppen (nur aktueller User)
  const blockedDateSet = new Set(blockedDates ?? [])

  // Availability-Index: user_id → date → {status, from_time, until_time}
  const availMap = new Map<string, Map<string, any>>()
  for (const a of availabilities) {
    if (!availMap.has(a.user_id)) availMap.set(a.user_id, new Map())
    availMap.get(a.user_id)!.set(a.date, a)
  }

  return (
    <div className="-mx-4">
      <div className="flex">
        {/* Fixierte Namensspalte – außerhalb des Scroll-Bereichs */}
        <div className="w-20 shrink-0 bg-background">
          {/* Platzhalter für die Datums-Kopfzeile */}
          <div className="h-8 mb-1" />
          {members.map((member: any) => {
            const name = member.display_name ?? member.profiles?.display_name ?? member.email?.split('@')[0] ?? '?'
            return (
              <div
                key={member.user_id}
                className="h-7 mb-1 flex items-center pl-4 pr-1 text-xs truncate text-muted-foreground"
                title={name}
              >
                {name}
              </div>
            )
          })}
        </div>

        {/* Scrollbarer Datumsbereich */}
        <div className="flex-1 overflow-x-auto pr-4">
          {/* Kopfzeile: Tage */}
          <div className="flex mb-1">
            {days.map((d) => (
              <div key={d} className="w-8 shrink-0 h-8 flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground leading-none">
                  {format(parseISO(d), 'EE', { locale: de }).slice(0, 2)}
                </div>
                <div className="text-[11px] font-medium leading-tight">
                  {format(parseISO(d), 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Zeilen: Mitglieder */}
          {members.map((member: any) => {
            const dayMap = availMap.get(member.user_id) ?? new Map()
            return (
              <div key={member.user_id} className="flex items-center mb-1 h-7">
                {days.map((d) => {
                  const avail = dayMap.get(d)
                  const isConfirmed = confirmedByMember.get(member.user_id)?.has(d) ?? false
                  const isBlockedOtherGroup = !isConfirmed && member.user_id === currentUserId && blockedDateSet.has(d)

                  return (
                    <div
                      key={d}
                      className={cn(
                        'w-8 shrink-0 h-6 rounded flex items-center justify-center',
                        isConfirmed
                          ? 'bg-blue-100'
                          : isBlockedOtherGroup
                            ? 'bg-purple-100'
                            : avail
                              ? STATUS_CELL[avail.status]
                              : 'bg-muted'
                      )}
                      title={isBlockedOtherGroup ? 'Termin in anderer Gruppe' : avail ? `${avail.status}${avail.from_time ? ` ${avail.from_time.slice(0, 5)}–${avail.until_time?.slice(0, 5) ?? ''}` : ''}` : 'keine Angabe'}
                    >
                      {isConfirmed && <Check className="h-3 w-3 text-blue-600" />}
                      {isBlockedOtherGroup && <Lock className="h-3 w-3 text-purple-500" />}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 mt-4 px-4 text-xs text-muted-foreground">
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
