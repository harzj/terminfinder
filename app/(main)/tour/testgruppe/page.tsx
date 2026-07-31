import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, addDays } from 'date-fns'
import { getPlanningRangeFromMonday } from '@/lib/planningWindow'
import GruppenUebersicht from '@/components/GruppenUebersicht'
import NaechsteTermine from '@/components/NaechsteTermine'
import TourTestgruppeClient from './TourTestgruppeClient'

export default async function TourTestgruppePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const group = { id: 'tour-demo', name: 'Tour-Testgruppe', min_participants: 3 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { startDate, endDate } = getPlanningRangeFromMonday(3, today)
  const members = [
    { user_id: 'u1', display_name: 'Mara', profiles: { availability_planning_months: 1 } },
    { user_id: 'u2', display_name: 'Noah', profiles: { availability_planning_months: 2 } },
    { user_id: 'u3', display_name: 'Lina', profiles: { availability_planning_months: 3 } },
    { user_id: 'u4', display_name: 'Jonas', profiles: { availability_planning_months: 2 } },
    { user_id: 'u5', display_name: 'Tina', profiles: { availability_planning_months: 1 } },
  ]

  const availabilities = members.flatMap((member, index) => {
    return Array.from({ length: 18 }, (_, dayIndex) => {
      const date = format(addDays(startDate, dayIndex), 'yyyy-MM-dd')
      const available = (dayIndex + index) % 3 !== 0
      return available
        ? [{ user_id: member.user_id, date, status: (dayIndex + index) % 2 === 0 ? 'available' : 'uncertain', from_time: '18:00', until_time: '22:00', profiles: { display_name: member.display_name } }]
        : []
    }).flat()
  })

  const events: any[] = []

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div id="tour-testgroup-overview">
        <h1 className="text-xl font-bold">Tour-Testgruppe</h1>
        <p className="text-sm text-muted-foreground">Hier kannst du die Gruppenansicht gefahrlos ausprobieren.</p>
      </div>
      <div id="tour-testgroup-next">
        <GruppenUebersicht
          members={members}
          availabilities={availabilities}
          events={events}
          startDate={format(startDate, 'yyyy-MM-dd')}
          endDate={format(endDate, 'yyyy-MM-dd')}
          currentUserId={user.id}
        />
        <div className="mt-4">
          <NaechsteTermine
            group={group}
            availabilities={availabilities}
            members={members}
            startDate={format(startDate, 'yyyy-MM-dd')}
            endDate={format(endDate, 'yyyy-MM-dd')}
            currentUserId={user.id}
            events={events}
            readOnly
          />
        </div>
      </div>
      <TourTestgruppeClient />
    </div>
  )
}
