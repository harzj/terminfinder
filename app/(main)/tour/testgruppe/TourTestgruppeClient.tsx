'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import GruppenUebersicht from '@/components/GruppenUebersicht'
import NaechsteTermine from '@/components/NaechsteTermine'

type ResponseType = 'accepted' | 'declined' | 'uncertain'

interface DemoEvent {
  id: string
  status: 'voting' | 'confirmed' | 'cancelled'
  proposed_date: string
  from_time: string | null
  until_time: string | null
  min_participants: number
  event_responses: Array<{ user_id: string; response: ResponseType }>
  event_games: Array<{ id: string; name: string; thumbnail_url: string | null }>
}

interface DemoArchiveEvent {
  id: string
  proposed_date: string
  from_time: string | null
  until_time: string | null
  event_responses: Array<{ response: string; user_id: string }>
  event_games: Array<{ id: string; name: string; thumbnail_url: string | null }>
}

const group = { id: 'tour-demo', name: 'Tour-Testgruppe', min_participants: 3 }

const members = [
  { user_id: 'u1', display_name: 'Mara', profiles: { availability_planning_months: 1 } },
  { user_id: 'u2', display_name: 'Noah', profiles: { availability_planning_months: 2 } },
  { user_id: 'u3', display_name: 'Lina', profiles: { availability_planning_months: 3 } },
  { user_id: 'u4', display_name: 'Jonas', profiles: { availability_planning_months: 2 } },
  { user_id: 'u5', display_name: 'Tina', profiles: { availability_planning_months: 1 } },
]

const availabilities = [
  { user_id: 'u1', date: '2026-08-03', status: 'available', from_time: '18:00', until_time: '22:00', profiles: { display_name: 'Mara' } },
  { user_id: 'u2', date: '2026-08-03', status: 'available', from_time: '18:30', until_time: '22:30', profiles: { display_name: 'Noah' } },
  { user_id: 'u3', date: '2026-08-03', status: 'uncertain', from_time: '19:00', until_time: '23:00', profiles: { display_name: 'Lina' } },
  { user_id: 'u4', date: '2026-08-03', status: 'available', from_time: '18:00', until_time: '23:00', profiles: { display_name: 'Jonas' } },
  { user_id: 'u5', date: '2026-08-03', status: 'uncertain', from_time: '18:00', until_time: '22:00', profiles: { display_name: 'Tina' } },
  { user_id: 'u1', date: '2026-08-10', status: 'available', from_time: '19:00', until_time: '23:00', profiles: { display_name: 'Mara' } },
  { user_id: 'u2', date: '2026-08-10', status: 'uncertain', from_time: '18:00', until_time: '23:00', profiles: { display_name: 'Noah' } },
  { user_id: 'u3', date: '2026-08-10', status: 'available', from_time: '18:00', until_time: '23:00', profiles: { display_name: 'Lina' } },
  { user_id: 'u4', date: '2026-08-10', status: 'available', from_time: '18:00', until_time: '23:00', profiles: { display_name: 'Jonas' } },
  { user_id: 'u5', date: '2026-08-10', status: 'available', from_time: '18:00', until_time: '22:00', profiles: { display_name: 'Tina' } },
]

const votingSeed: DemoEvent = {
  id: 'demo-vote-1',
  status: 'voting',
  proposed_date: '2026-08-10',
  from_time: '18:00',
  until_time: '22:30',
  min_participants: 3,
  event_responses: [
    { user_id: 'u1', response: 'accepted' },
    { user_id: 'u2', response: 'uncertain' },
    { user_id: 'u3', response: 'declined' },
    { user_id: 'u4', response: 'uncertain' },
    { user_id: 'u5', response: 'declined' },
  ],
  event_games: [
    { id: 'g1', name: 'Catan', thumbnail_url: null },
  ],
}

const archiveSeed: DemoArchiveEvent[] = [
  {
    id: 'a1',
    proposed_date: '2026-06-12',
    from_time: '18:00',
    until_time: '23:00',
    event_responses: [
      { user_id: 'u1', response: 'accepted' },
      { user_id: 'u2', response: 'accepted' },
      { user_id: 'u3', response: 'accepted' },
    ],
    event_games: [{ id: 'g2', name: 'Catan', thumbnail_url: null }],
  },
  {
    id: 'a2',
    proposed_date: '2026-05-24',
    from_time: '19:00',
    until_time: '23:00',
    event_responses: [
      { user_id: 'u1', response: 'accepted' },
      { user_id: 'u2', response: 'accepted' },
      { user_id: 'u4', response: 'accepted' },
      { user_id: 'u5', response: 'accepted' },
    ],
    event_games: [{ id: 'g3', name: 'Hitster', thumbnail_url: null }],
  },
  {
    id: 'a3',
    proposed_date: '2026-04-18',
    from_time: '18:30',
    until_time: '23:30',
    event_responses: [
      { user_id: 'u1', response: 'accepted' },
      { user_id: 'u2', response: 'accepted' },
      { user_id: 'u3', response: 'accepted' },
      { user_id: 'u4', response: 'accepted' },
    ],
    event_games: [{ id: 'g4', name: 'Mysterium', thumbnail_url: null }],
  },
]

export default function TourTestgruppeClient() {
  const router = useRouter()
  const [events, setEvents] = useState<DemoEvent[]>([votingSeed])
  const [activeTab, setActiveTab] = useState<'uebersicht' | 'abstimmungen' | 'naechste' | 'archiv'>('uebersicht')

  const votingEvents = useMemo(() => events.filter((event) => event.status === 'voting'), [events])
  const combinedEvents = useMemo(
    () => [
      ...events,
      ...archiveSeed.map((event) => ({
        ...event,
        status: 'confirmed' as const,
      })),
    ],
    [events]
  )

  const currentVoting = votingEvents[0] ?? null

  const updateResponse = (response: ResponseType) => {
    if (!currentVoting) return
    const nextEvents = events.map((event) => {
      if (event.id !== currentVoting.id) return event
      const current = event.event_responses.find((entry) => entry.user_id === 'u1')?.response ?? 'uncertain'
      const nextResponses = event.event_responses.map((entry) =>
        entry.user_id === 'u1' ? { ...entry, response } : entry
      )
      const acceptedCount = nextResponses.filter((entry) => entry.response === 'accepted').length
      return {
        ...event,
        status: response === 'accepted' && acceptedCount >= event.min_participants ? 'confirmed' : 'voting',
        event_responses: nextResponses,
      }
    })
    setEvents(nextEvents)
  }

  const nextTab = () => {
    const order: Array<typeof activeTab> = ['uebersicht', 'abstimmungen', 'naechste', 'archiv']
    const nextIndex = Math.min(order.indexOf(activeTab) + 1, order.length - 1)
    setActiveTab(order[nextIndex])
  }

  const finishTour = async () => {
    await fetch('/api/profile/onboarding-tour', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seen: true }),
    })
    router.push('/verfuegbarkeit')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-1">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full flex-col gap-0">
          <TabsList variant="line" className="w-full rounded-none border-b border-border bg-background h-auto p-0">
            <TabsTrigger value="uebersicht" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Übersicht</TabsTrigger>
            <TabsTrigger value="abstimmungen" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Abstimmungen</TabsTrigger>
            <TabsTrigger value="naechste" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Nächste</TabsTrigger>
            <TabsTrigger value="archiv" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Archiv</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="p-4 mt-0">
            <GruppenUebersicht
              members={members}
              availabilities={availabilities}
              events={combinedEvents}
              startDate="2026-08-03"
              endDate="2026-10-25"
              currentUserId="u1"
            />
          </TabsContent>

          <TabsContent value="abstimmungen" className="p-4 mt-0 space-y-3">
            <div className="space-y-3">
              {votingEvents.map((event) => {
                const acceptedCount = event.event_responses.filter((entry) => entry.response === 'accepted').length
                const isConfirmed = event.status === 'confirmed'
                return (
                  <Card key={event.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant={isConfirmed ? 'default' : 'outline'}>
                          {isConfirmed ? 'Bestätigt' : 'Aktive Abstimmung'}
                        </Badge>
                        {event.proposed_date}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">{acceptedCount} Zusagen · min. {event.min_participants}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateResponse('accepted')}><CheckCircle2 className="h-4 w-4 mr-1" />Zustimmung</Button>
                        <Button size="sm" variant="outline" onClick={() => updateResponse('declined')}><XCircle className="h-4 w-4 mr-1" />Ablehnung</Button>
                        <Button size="sm" variant="outline" onClick={() => updateResponse('uncertain')}><HelpCircle className="h-4 w-4 mr-1" />Unklar</Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="naechste" className="p-4 mt-0">
            <NaechsteTermine
              group={group}
              availabilities={availabilities}
              members={members}
              startDate="2026-08-03"
              endDate="2026-10-25"
              currentUserId="u1"
              events={combinedEvents}
              readOnly
            />
          </TabsContent>

          <TabsContent value="archiv" className="p-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Archiv</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {archiveSeed.map((event) => {
                  const attendees = event.event_responses.filter((response) => response.response === 'accepted').length
                  return (
                    <div key={event.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{event.proposed_date}</p>
                        <span className="text-xs text-muted-foreground">{attendees} Teilnehmer</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {event.event_games.map((game) => (
                          <Badge key={game.name} variant="outline">{game.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="flex-1" onClick={nextTab}>
          Nächsten Tab zeigen
        </Button>
        <Button id="tour-testgroup-finish" className="flex-1" onClick={finishTour}>
          Tour beenden und zurück zur Verfügbarkeit
        </Button>
      </div>
    </div>
  )
}
