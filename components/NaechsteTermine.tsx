'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { computeOverlaps } from '@/lib/overlap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, Users } from 'lucide-react'

interface Props {
  group: any
  availabilities: any[]
  members: any[]
  startDate: string
  endDate: string
  currentUserId: string
}

export default function NaechsteTermine({ group, availabilities, members, startDate, endDate, currentUserId }: Props) {
  const router = useRouter()
  const [proposing, setProposing] = useState<string | null>(null)

  const overlaps = useMemo(() => {
    const memberProfiles = members.map((m: any) => ({
      id: m.user_id,
      display_name: m.profiles?.display_name ?? m.email?.split('@')[0] ?? '?',
    }))

    // availability mit profiles anreichern
    const enriched = availabilities.map((a: any) => ({
      ...a,
      profiles: { display_name: a.profiles?.display_name ?? '?' },
    }))

    return computeOverlaps(
      enriched,
      memberProfiles as any,
      group.min_participants,
      parseISO(startDate),
      parseISO(endDate)
    ).slice(0, 10)
  }, [availabilities, members, group.min_participants, startDate, endDate])

  const handlePropose = async (overlap: typeof overlaps[0]) => {
    setProposing(overlap.date)
    const supabase = createClient()
    await supabase.from('events').insert({
      group_id: group.id,
      proposed_date: overlap.date,
      from_time: overlap.from_time !== '15:00' ? overlap.from_time : null,
      until_time: overlap.until_time !== '24:00' ? overlap.until_time : null,
      min_participants: group.min_participants,
      proposed_by: currentUserId,
    })
    setProposing(null)
    router.refresh()
  }

  if (overlaps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Keine gemeinsamen Termine</p>
        <p className="text-sm mt-1">
          Noch nicht genug Mitglieder haben ihre Verfügbarkeit eingetragen,
          oder es gibt keine Überschneidungen bei mindestens {group.min_participants} Personen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tage, an denen mindestens {group.min_participants} Mitglieder verfügbar sind:
      </p>
      {overlaps.map((overlap) => (
        <Card key={overlap.date}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-600" />
              {format(parseISO(overlap.date), 'EEEE, d. MMMM', { locale: de })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {overlap.from_time} – {overlap.until_time} Uhr
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {overlap.confirmed_participants.map((p) => (
                <Badge key={p.id} className="bg-green-500 text-xs">{p.display_name}</Badge>
              ))}
              {overlap.uncertain_participants.map((p) => (
                <Badge key={p.id} variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                  {p.display_name} (unklar)
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handlePropose(overlap)}
              disabled={proposing === overlap.date}
            >
              {proposing === overlap.date ? 'Wird vorgeschlagen…' : 'Als Abstimmung vorschlagen'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
