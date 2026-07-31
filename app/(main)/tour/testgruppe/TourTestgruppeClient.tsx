'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react'
import GruppenUebersicht from '@/components/GruppenUebersicht'
import NaechsteTermine from '@/components/NaechsteTermine'

type ResponseType = 'accepted' | 'declined' | 'uncertain'
type TabKey = 'uebersicht' | 'abstimmungen' | 'naechste' | 'archiv'

interface DemoMember {
  user_id: string
  display_name: string
  profiles: { availability_planning_months: number }
}

interface DemoAvailability {
  user_id: string
  date: string
  status: 'available' | 'uncertain'
  from_time: string | null
  until_time: string | null
  profiles: { display_name: string }
}

interface DemoEvent {
  id: string
  status: 'voting' | 'confirmed' | 'cancelled'
  proposed_date: string
  from_time: string | null
  until_time: string | null
  min_participants: number
  proposed_by: string
  host_user_id: string | null
  notes: string | null
  profiles: { display_name: string }
  event_responses: Array<{ user_id: string; response: ResponseType; host_offer?: boolean; profiles: { display_name: string }; previous_response?: ResponseType | null }>
  event_games: Array<{ id: string; name: string; thumbnail_url: string | null }>
}

interface DemoArchiveEvent {
  id: string
  proposed_date: string
  from_time: string | null
  until_time: string | null
  event_responses: Array<{ response: ResponseType; user_id: string; profiles: { display_name: string } }>
  event_games: Array<{ id: string; name: string; thumbnail_url: string | null }>
}

const group = { id: 'tour-demo', name: 'Tour-Testgruppe', min_participants: 3 }

const members: DemoMember[] = [
  { user_id: 'u1', display_name: 'Mara', profiles: { availability_planning_months: 1 } },
  { user_id: 'u2', display_name: 'Noah', profiles: { availability_planning_months: 2 } },
  { user_id: 'u3', display_name: 'Lina', profiles: { availability_planning_months: 3 } },
  { user_id: 'u4', display_name: 'Jonas', profiles: { availability_planning_months: 2 } },
  { user_id: 'u5', display_name: 'Tina', profiles: { availability_planning_months: 1 } },
]

const availabilityByMember: Record<string, Array<Pick<DemoAvailability, 'date' | 'status' | 'from_time' | 'until_time'>>> = {
  // Jeder Mensch hat hier bewusst eigene Tage, damit die Übersicht und „Nächste Termine“ echte Unterschiede zeigen.
  u1: [
    { date: '2026-08-03', status: 'available', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-05', status: 'uncertain', from_time: '18:00', until_time: '21:30' },
    { date: '2026-08-06', status: 'available', from_time: '18:00', until_time: '23:00' },
    { date: '2026-08-09', status: 'uncertain', from_time: '19:00', until_time: '22:00' },
    { date: '2026-08-12', status: 'available', from_time: '18:30', until_time: '23:00' },
    { date: '2026-08-21', status: 'available', from_time: '19:00', until_time: '22:30' },
  ],
  u2: [
    { date: '2026-08-03', status: 'available', from_time: '18:00', until_time: '22:15' },
    { date: '2026-08-04', status: 'uncertain', from_time: '18:30', until_time: '22:30' },
    { date: '2026-08-08', status: 'available', from_time: '18:00', until_time: '23:00' },
    { date: '2026-08-09', status: 'available', from_time: '18:30', until_time: '22:30' },
    { date: '2026-08-12', status: 'uncertain', from_time: '19:00', until_time: '23:00' },
    { date: '2026-08-21', status: 'available', from_time: '18:00', until_time: '23:00' },
  ],
  u3: [
    { date: '2026-08-04', status: 'available', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-09', status: 'available', from_time: '18:30', until_time: '23:00' },
    { date: '2026-08-12', status: 'uncertain', from_time: '19:00', until_time: '22:30' },
    { date: '2026-08-15', status: 'available', from_time: '18:00', until_time: '23:00' },
    { date: '2026-08-21', status: 'uncertain', from_time: '19:00', until_time: '22:00' },
    { date: '2026-08-28', status: 'available', from_time: '18:00', until_time: '23:00' },
  ],
  u4: [
    { date: '2026-08-06', status: 'available', from_time: '18:30', until_time: '22:30' },
    { date: '2026-08-09', status: 'uncertain', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-12', status: 'available', from_time: '18:00', until_time: '23:00' },
    { date: '2026-08-19', status: 'available', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-21', status: 'uncertain', from_time: '19:00', until_time: '23:00' },
  ],
  u5: [
    { date: '2026-08-03', status: 'uncertain', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-06', status: 'available', from_time: '18:00', until_time: '23:00' },
    { date: '2026-08-09', status: 'available', from_time: '18:00', until_time: '22:30' },
    { date: '2026-08-12', status: 'available', from_time: '18:30', until_time: '23:00' },
    { date: '2026-08-19', status: 'uncertain', from_time: '18:00', until_time: '22:00' },
    { date: '2026-08-21', status: 'available', from_time: '19:00', until_time: '23:00' },
  ],
}

const baseAvailability: DemoAvailability[] = members.flatMap((member) => {
  return availabilityByMember[member.user_id].map((availability) => ({
    user_id: member.user_id,
    date: availability.date,
    status: availability.status,
    from_time: availability.from_time,
    until_time: availability.until_time,
    profiles: { display_name: member.display_name },
  }))
})

const initialEvents: DemoEvent[] = [
  {
    id: 'demo-vote-1',
    status: 'voting',
    proposed_date: '2026-08-10',
    from_time: '18:00',
    until_time: '22:30',
    min_participants: 3,
    // In der Demo ist der aktuelle User (u1/Mara) Initiator, damit die Host-Auswahl testbar ist.
    proposed_by: 'u1',
    host_user_id: null,
    notes: 'Spieleabend mit etwas mehr Zeit',
    profiles: { display_name: 'Mara' },
    event_responses: [
      { user_id: 'u5', response: 'accepted', host_offer: true, profiles: { display_name: 'Tina' } },
      { user_id: 'u4', response: 'accepted', host_offer: false, profiles: { display_name: 'Tim' } },
      { user_id: 'u2', response: 'declined', profiles: { display_name: 'Timur' } },
      { user_id: 'u3', response: 'uncertain', profiles: { display_name: 'Lina' } },
      { user_id: 'u1', response: 'uncertain', host_offer: false, profiles: { display_name: 'Mara' } },
    ],
    event_games: [
      { id: 'g-catan', name: 'Catan', thumbnail_url: null },
    ],
  },
  {
    id: 'demo-vote-2',
    status: 'confirmed',
    proposed_date: '2026-09-04',
    from_time: '19:00',
    until_time: '23:00',
    min_participants: 3,
    proposed_by: 'u3',
    host_user_id: 'u5',
    notes: 'Schon genug Zusagen',
    profiles: { display_name: 'Lina' },
    event_responses: [
      { user_id: 'u5', response: 'accepted', host_offer: true, profiles: { display_name: 'Tina' } },
      { user_id: 'u4', response: 'accepted', host_offer: false, profiles: { display_name: 'Tim' } },
      { user_id: 'u2', response: 'accepted', host_offer: true, profiles: { display_name: 'Timur' } },
      { user_id: 'u3', response: 'uncertain', profiles: { display_name: 'Lina' } },
      { user_id: 'u1', response: 'declined', profiles: { display_name: 'Mara' } },
    ],
    event_games: [
      { id: 'g-hitster', name: 'Hitster', thumbnail_url: null },
      { id: 'g-myst', name: 'Mysterium', thumbnail_url: null },
    ],
  },
]

const archiveSeed: DemoArchiveEvent[] = [
  {
    id: 'a1',
    proposed_date: '2026-06-12',
    from_time: '18:00',
    until_time: '23:00',
    event_responses: [
      { user_id: 'u1', response: 'accepted', profiles: { display_name: 'Mara' } },
      { user_id: 'u2', response: 'accepted', profiles: { display_name: 'Noah' } },
      { user_id: 'u3', response: 'accepted', profiles: { display_name: 'Lina' } },
      { user_id: 'u4', response: 'declined', profiles: { display_name: 'Jonas' } },
      { user_id: 'u5', response: 'uncertain', profiles: { display_name: 'Tina' } },
    ],
    event_games: [{ id: 'g2', name: 'Catan', thumbnail_url: null }],
  },
  {
    id: 'a2',
    proposed_date: '2026-05-24',
    from_time: '19:00',
    until_time: '23:00',
    event_responses: [
      { user_id: 'u1', response: 'accepted', profiles: { display_name: 'Mara' } },
      { user_id: 'u2', response: 'accepted', profiles: { display_name: 'Noah' } },
      { user_id: 'u3', response: 'accepted', profiles: { display_name: 'Lina' } },
      { user_id: 'u4', response: 'accepted', profiles: { display_name: 'Jonas' } },
      { user_id: 'u5', response: 'declined', profiles: { display_name: 'Tina' } },
    ],
    event_games: [{ id: 'g3', name: 'Hitster', thumbnail_url: null }],
  },
  {
    id: 'a3',
    proposed_date: '2026-04-18',
    from_time: '18:30',
    until_time: '23:30',
    event_responses: [
      { user_id: 'u1', response: 'accepted', profiles: { display_name: 'Mara' } },
      { user_id: 'u2', response: 'accepted', profiles: { display_name: 'Noah' } },
      { user_id: 'u3', response: 'accepted', profiles: { display_name: 'Lina' } },
      { user_id: 'u4', response: 'accepted', profiles: { display_name: 'Jonas' } },
      { user_id: 'u5', response: 'accepted', profiles: { display_name: 'Tina' } },
    ],
    event_games: [{ id: 'g4', name: 'Mysterium', thumbnail_url: null }],
  },
]

const bggLookupIds = {
  Catan: 13,
  Hitster: 318243,
  Mysterium: 181304,
} as const

function labelForResponse(response: ResponseType) {
  if (response === 'accepted') return 'Zugesagt'
  if (response === 'declined') return 'Abgelehnt'
  return 'Unklar'
}

export default function TourTestgruppeClient() {
  const router = useRouter()
  const [events, setEvents] = useState<DemoEvent[]>(initialEvents)
  const [activeTab, setActiveTab] = useState<TabKey>('uebersicht')
  const [loadingGameImages, setLoadingGameImages] = useState(true)
  const [gameImages, setGameImages] = useState<Record<string, string | null>>({})
  const [savingResponse, setSavingResponse] = useState<ResponseType | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadImages = async () => {
      const nextImages: Record<string, string | null> = {}
      for (const [name, searchId] of Object.entries(bggLookupIds)) {
        try {
          const response = await fetch(`/api/bgg?id=${searchId}`)
          if (!response.ok) {
            nextImages[name] = null
            continue
          }
          const detail = await response.json()
          nextImages[name] = detail?.thumbnail ?? null
        } catch {
          nextImages[name] = null
        }
      }
      if (!cancelled) {
        setGameImages(nextImages)
        setLoadingGameImages(false)
      }
    }

    void loadImages()
    return () => { cancelled = true }
  }, [])

  const votingEvents = useMemo(() => events.filter((event) => event.status !== 'cancelled'), [events])
  const combinedEvents = useMemo(
    () => [
      ...events,
      ...archiveSeed.map((event) => ({
        ...event,
        status: 'confirmed' as const,
        proposed_by: 'u2',
        notes: null,
        profiles: { display_name: 'Noah' },
      })),
    ],
    [events]
  )

  const currentVoting = events.find((event) => event.id === 'demo-vote-1') ?? null

  const updateResponse = (response: ResponseType) => {
    if (!currentVoting) return
    setSavingResponse(response)
    setEvents((prev) => prev.map((event) => {
      if (event.id !== currentVoting.id) return event

      const nextResponses: DemoEvent['event_responses'] = event.event_responses.map((entry) => {
        if (entry.user_id !== 'u1') return entry

        const previousResponse: ResponseType | null = entry.response === 'accepted' && response !== 'accepted'
          ? 'accepted'
          : null

        return {
          ...entry,
          response,
          host_offer: response === 'accepted' ? (entry.host_offer ?? false) : false,
          previous_response: previousResponse,
        }
      })
      const acceptedCount = nextResponses.filter((entry) => entry.response === 'accepted').length
      const nextStatus: DemoEvent['status'] = acceptedCount >= event.min_participants ? 'confirmed' : 'voting'
      const hostStillEligible = nextResponses.some((entry) => entry.user_id === event.host_user_id && entry.response === 'accepted' && entry.host_offer)

      return {
        ...event,
        status: nextStatus,
        host_user_id: hostStillEligible ? event.host_user_id : null,
        event_responses: nextResponses,
      }
    }))
    setSavingResponse(null)
  }

  const updateHostOffer = (offered: boolean) => {
    if (!currentVoting) return
    setEvents((prev) => prev.map((event) => {
      if (event.id !== currentVoting.id) return event

      const nextResponses: DemoEvent['event_responses'] = event.event_responses.map((entry) => {
        if (entry.user_id !== 'u1') return entry
        if (entry.response !== 'accepted') return entry
        return {
          ...entry,
          host_offer: offered,
        }
      })

      const hostStillEligible = nextResponses.some((entry) => entry.user_id === event.host_user_id && entry.response === 'accepted' && entry.host_offer)
      return {
        ...event,
        event_responses: nextResponses,
        host_user_id: hostStillEligible ? event.host_user_id : null,
      }
    }))
  }

  const selectHost = (eventId: string, hostUserId: string) => {
    setEvents((prev) => prev.map((event) => {
      if (event.id !== eventId) return event
      return {
        ...event,
        host_user_id: hostUserId,
      }
    }))
  }

  const nextTab = () => {
    const order: TabKey[] = ['uebersicht', 'abstimmungen', 'naechste', 'archiv']
    const nextIndex = Math.min(order.indexOf(activeTab) + 1, order.length - 1)
    setActiveTab(order[nextIndex])
  }

  const finishTour = async () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('onboarding_tour_demo_mode')
    }
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
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-2">
          <p>In der Testgruppe kannst du die Tabs selbst durchklicken. Die Änderungen bleiben lokal in der Tour.</p>
          <p>{loadingGameImages ? 'BGG-Spiele werden geladen…' : 'BGG-Spiele geladen.'}</p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-background p-1">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="w-full flex-col gap-0">
          <TabsList variant="line" className="w-full rounded-none border-b border-border bg-background h-auto p-0">
            <TabsTrigger value="uebersicht" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Übersicht</TabsTrigger>
            <TabsTrigger value="abstimmungen" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Abstimmungen</TabsTrigger>
            <TabsTrigger value="naechste" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Nächste</TabsTrigger>
            <TabsTrigger value="archiv" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">Archiv</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="p-4 mt-0">
            <GruppenUebersicht
              members={members}
              availabilities={baseAvailability}
              events={combinedEvents}
              startDate="2026-08-03"
              endDate="2026-10-25"
              currentUserId="u1"
            />
          </TabsContent>

          <TabsContent value="abstimmungen" className="p-4 mt-0 space-y-3">
            {votingEvents.map((event) => {
              const acceptedCount = event.event_responses.filter((entry) => entry.response === 'accepted').length
              const currentUser = event.event_responses.find((entry) => entry.user_id === 'u1')?.response ?? 'uncertain'
              const currentUserHostOffer = event.event_responses.find((entry) => entry.user_id === 'u1')?.host_offer === true
              const isConfirmed = event.status === 'confirmed'
              const isInitiator = event.proposed_by === 'u1'
              const hostCandidates = event.event_responses.filter((entry) => entry.response === 'accepted' && entry.host_offer)
              const selectedHostName = members.find((member) => member.user_id === event.host_user_id)?.display_name ?? null

              return (
                <Card key={event.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                      <Badge variant={isConfirmed ? 'default' : 'outline'} className={isConfirmed ? 'bg-green-500 text-white' : ''}>
                        {isConfirmed ? 'Bestätigt' : 'Aktive Abstimmung'}
                      </Badge>
                      {event.proposed_date}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {event.from_time?.slice(0, 5)} – {event.until_time?.slice(0, 5)} Uhr · {acceptedCount}/{event.min_participants} Zusagen
                    </p>
                    <p className="text-xs text-muted-foreground">Vorgeschlagen von {event.profiles.display_name}</p>
                    {event.notes && <p className="text-xs text-muted-foreground italic">{event.notes}</p>}
                    {selectedHostName && <p className="text-xs text-green-700">Gastgeber: {selectedHostName}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {event.event_games.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {event.event_games.map((game) => (
                          <div key={game.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                            {gameImages[game.name] ? (
                              <img src={gameImages[game.name] ?? ''} alt={game.name} className="h-10 w-8 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-8 rounded bg-muted" />
                            )}
                            <span className="text-xs font-medium">{game.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {event.event_responses.map((entry) => (
                        <Badge
                          key={entry.user_id}
                          variant="outline"
                          className={entry.response === 'accepted'
                            ? 'border-green-300 text-green-700'
                            : entry.response === 'declined'
                              ? 'border-red-300 text-red-600 line-through'
                              : 'border-yellow-300 text-yellow-700'}
                        >
                          {entry.profiles.display_name}: {labelForResponse(entry.response)}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(['accepted', 'uncertain', 'declined'] as const).map((response) => {
                        const label = response === 'accepted' ? 'Zustimmung' : response === 'uncertain' ? 'Unklar' : 'Ablehnung'
                        const icon = response === 'accepted' ? CheckCircle2 : response === 'uncertain' ? HelpCircle : XCircle
                        const Icon = icon
                        const active = currentUser === response
                        return (
                          <button
                            key={response}
                            type="button"
                            onClick={() => updateResponse(response)}
                            className={
                              active
                                ? response === 'accepted'
                                  ? 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-green-500 text-white border-green-600'
                                  : response === 'uncertain'
                                    ? 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-yellow-400 text-black border-yellow-500'
                                    : 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-red-100 text-red-700 border-red-300'
                                : response === 'accepted'
                                  ? 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-background text-green-700 border-green-300 hover:bg-green-50'
                                  : response === 'uncertain'
                                    ? 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-background text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                                    : 'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors bg-background text-red-700 border-red-300 hover:bg-red-50'
                            }
                          >
                            <Icon className="h-4 w-4 mx-auto mb-1" />
                            {savingResponse === response ? '…' : active ? `Deine Antwort · ${label}` : label}
                          </button>
                        )
                      })}
                    </div>

                    {currentUser === 'accepted' && (
                      <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={currentUserHostOffer}
                          onChange={(event) => updateHostOffer(event.target.checked)}
                          className="h-4 w-4"
                        />
                        Als Gastgeber anbieten
                      </label>
                    )}

                    {hostCandidates.length > 0 && (
                      <div className="space-y-2 rounded-md border border-border px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground">Mögliche Gastgeber</p>
                        <div className="flex flex-wrap gap-1.5">
                          {hostCandidates.map((candidate) => {
                            const active = event.host_user_id === candidate.user_id
                            return (
                              <button
                                key={candidate.user_id}
                                type="button"
                                onClick={() => isInitiator && selectHost(event.id, candidate.user_id)}
                                disabled={!isInitiator}
                                className={active
                                  ? 'rounded-full border border-green-600 bg-green-500 px-2.5 py-1 text-xs text-white'
                                  : 'rounded-full border border-green-300 bg-background px-2.5 py-1 text-xs text-green-700'}
                                title={isInitiator ? 'Als Gastgeber festlegen' : 'Nur der Initiator kann auswählen'}
                              >
                                {candidate.profiles.display_name}
                              </button>
                            )
                          })}
                        </div>
                        {!isInitiator && (
                          <p className="text-xs text-muted-foreground">Nur der Initiator kann den Gastgeber festlegen.</p>
                        )}
                      </div>
                    )}

                    {isConfirmed && (
                      <p className="text-xs text-green-700 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                        Durch die ausreichenden Zusagen ist der Termin jetzt bestätigt.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="naechste" className="p-4 mt-0">
            <NaechsteTermine
              group={group}
              availabilities={baseAvailability}
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
                  const attendees = event.event_responses.filter((response) => response.response === 'accepted')
                  return (
                    <div key={event.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{event.proposed_date}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.from_time?.slice(0, 5)} – {event.until_time?.slice(0, 5)} Uhr · {attendees.length} Teilnehmende
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {event.event_games.map((game) => (
                            <Badge key={game.name} variant="outline" className="text-[10px]">
                              {game.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.event_games.map((game) => (
                          <div key={game.name} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
                            {gameImages[game.name] ? (
                              <img src={gameImages[game.name] ?? ''} alt={game.name} className="h-10 w-8 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-8 rounded bg-muted" />
                            )}
                            <span className="text-xs font-medium">{game.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {attendees.map((entry) => (
                          <Badge key={entry.user_id} variant="outline" className="border-green-300 text-green-700">
                            {entry.profiles.display_name}
                          </Badge>
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
