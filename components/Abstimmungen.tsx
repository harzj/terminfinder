'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, HelpCircle, Plus, Calendar, X, Clock, AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BggCollectionItem {
  id: number
  name: string
  thumbnail_url: string | null
}

interface BggSearchItem {
  id: number
  name: string
  year?: number
  thumbnail_url: string | null
}

interface Props {
  group: any
  events: any[]
  currentUserId: string
  members: any[]
  availabilities: any[]
  bggUsername?: string | null
  bggCollection?: Array<{ id: number; name: string; thumbnail_url: string | null }> | null
}

const RESPONSE_LABELS = {
  accepted: { label: 'Zugesagt', icon: CheckCircle2, color: 'text-green-600' },
  declined: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500' },
  uncertain: { label: 'Unklar', icon: HelpCircle, color: 'text-yellow-500' },
}

function computeOverlap(availabilities: any[], date: string): { from: string; until: string } | null {
  const day = availabilities.filter(a => a.date === date && a.from_time && a.until_time)
  if (day.length === 0) return null
  const latestStart = day.reduce((max: string, a: any) => a.from_time > max ? a.from_time : max, '00:00')
  const earliestEnd = day.reduce((min: string, a: any) => a.until_time < min ? a.until_time : min, '23:59')
  return latestStart < earliestEnd ? { from: latestStart.slice(0, 5), until: earliestEnd.slice(0, 5) } : null
}

export default function Abstimmungen({ group, events, currentUserId, members, availabilities, bggUsername, bggCollection }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; label: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newFrom, setNewFrom] = useState('')
  const [newUntil, setNewUntil] = useState('')
  const [newMin, setNewMin] = useState(group.min_participants)
  const [newNote, setNewNote] = useState('')
  const [creating, setCreating] = useState(false)

  // Zeitfenster-Vorschlag wenn Datum gewählt
  const [overlapSuggestion, setOverlapSuggestion] = useState<{ from: string; until: string } | null>(null)

  useEffect(() => {
    if (!newDate) { setOverlapSuggestion(null); return }
    const overlap = computeOverlap(availabilities, newDate)
    setOverlapSuggestion(overlap)
    if (overlap) {
      setNewFrom(overlap.from)
      setNewUntil(overlap.until)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDate])

  // Spiele-Vorschlag
  const [selectedGames, setSelectedGames] = useState<BggCollectionItem[]>([])
  const [gameSearch, setGameSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'collection' | 'all'>('all')
  const [allGameResults, setAllGameResults] = useState<BggSearchItem[]>([])
  const [searchingAllGames, setSearchingAllGames] = useState(false)

  const hasPublicProfileCollection = Boolean(bggUsername?.trim()) && (bggCollection?.length ?? 0) > 0

  useEffect(() => {
    if (!hasPublicProfileCollection) {
      setSearchMode('all')
    }
  }, [hasPublicProfileCollection])

  useEffect(() => {
    if (searchMode !== 'all') return
    const query = gameSearch.trim()
    if (!query) {
      setAllGameResults([])
      setSearchingAllGames(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearchingAllGames(true)
      try {
        const res = await fetch(`/api/bgg?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!res.ok) {
          setAllGameResults([])
          return
        }
        const data: BggSearchItem[] = await res.json()
        setAllGameResults(data)
      } catch {
        setAllGameResults([])
      } finally {
        setSearchingAllGames(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [gameSearch, searchMode])

  const collectionResults = bggCollection && gameSearch.trim()
    ? bggCollection.filter(g => g.name.toLowerCase().includes(gameSearch.trim().toLowerCase())).slice(0, 15)
    : []

  const allResults: BggCollectionItem[] = allGameResults.map((item) => ({
    id: item.id,
    name: item.year ? `${item.name} (${item.year})` : item.name,
    thumbnail_url: item.thumbnail_url,
  }))

  const visibleResults = searchMode === 'collection' ? collectionResults : allResults

  const canAddManual = gameSearch.trim().length > 0 &&
    !selectedGames.some(g => g.name.toLowerCase() === gameSearch.trim().toLowerCase())

  const toggleGame = (item: BggCollectionItem) => {
    setSelectedGames(prev =>
      prev.some(g => g.id === item.id)
        ? prev.filter(g => g.id !== item.id)
        : [...prev, item]
    )
  }

  const addManualGame = () => {
    const name = gameSearch.trim()
    if (!name) return
    const fake: BggCollectionItem = { id: -(Date.now()), name, thumbnail_url: null }
    setSelectedGames(prev => [...prev, fake])
    setGameSearch('')
  }

  const handleResponse = async (eventId: string, response: 'accepted' | 'declined' | 'uncertain') => {
    setLoading(eventId + response)
    const supabase = createClient()

    // Fetch current response to track changes away from 'accepted'
    const { data: currentRaw } = await supabase
      .from('event_responses')
      .select('response, previous_response')
      .eq('event_id', eventId)
      .eq('user_id', currentUserId)
      .maybeSingle()
    const current = currentRaw

    const currentResponse = current?.response ?? null
    let newPreviousResponse: 'accepted' | 'declined' | 'uncertain' | null
    if (response === 'accepted') {
      newPreviousResponse = null  // re-accepting clears the change flag
    } else if (currentResponse === 'accepted') {
      newPreviousResponse = 'accepted'  // was accepted, now changing away
    } else {
      newPreviousResponse = current?.previous_response ?? null  // preserve existing flag
    }

    await supabase.from('event_responses').upsert(
      { event_id: eventId, user_id: currentUserId, response, previous_response: newPreviousResponse, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' }
    )
    // Push-Benachrichtigungen feuern (fire-and-forget)
    fetch('/api/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, type: 'vote_success_check' }) })
    fetch('/api/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, type: 'change_check' }) })
    setLoading(null)
    router.refresh()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDate) return
    setCreating(true)
    const supabase = createClient()
    const { data: event } = await supabase.from('events').insert({
      group_id: group.id,
      proposed_date: newDate,
      from_time: newFrom || null,
      until_time: newUntil || null,
      min_participants: newMin,
      proposed_by: currentUserId,
      notes: newNote.trim() || null,
    }).select().single()

    if (event && selectedGames.length > 0) {
      await supabase.from('event_games').insert(
        selectedGames.map(g => ({
          event_id: event.id,
          bgg_id: g.id > 0 ? g.id : null,
          name: g.name,
          thumbnail_url: g.thumbnail_url,
          added_by: currentUserId,
        }))
      )
    }

    // Push-Benachrichtigung: neue Abstimmung (vor router.refresh, damit der Request nicht abgebrochen wird)
    if (event) {
      await fetch('/api/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: event.id, type: 'new_vote' }) })
    }
    setCreating(false)
    setDialogOpen(false)
    setSelectedGames([])
    setGameSearch('')
    setNewNote('')
    router.refresh()
  }

  const handleSoftCancel = async () => {
    if (!cancelTarget) return
    setLoading(cancelTarget.id)
    const supabase = createClient()
    // Push-Benachrichtigung (Event muss noch 'confirmed' sein für checkDedup)
    await fetch('/api/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: cancelTarget.id, type: 'event_cancelled' }) })
    await supabase.from('events').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', cancelTarget.id)
    setLoading(null)
    setCancelTarget(null)
    router.refresh()
  }

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return
    setLoading(deleteTarget.id)
    const supabase = createClient()
    // Erst benachrichtigen (Event muss noch existieren), dann löschen
    await fetch('/api/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: deleteTarget.id, type: 'vote_deleted' }) })
    await supabase.from('events').delete().eq('id', deleteTarget.id)
    setLoading(null)
    setDeleteTarget(null)
    router.refresh()
  }

  const votingEvents = events.filter((e: any) => e.status === 'voting')
  const confirmedEvents = events.filter((e: any) => e.status === 'confirmed')
  const cancelledEvents = events.filter((e: any) => e.status === 'cancelled')
  const allEvents = [
    ...confirmedEvents.sort((a: any, b: any) => a.proposed_date < b.proposed_date ? -1 : 1),
    ...votingEvents.sort((a: any, b: any) => a.proposed_date < b.proposed_date ? -1 : 1),
    ...cancelledEvents.sort((a: any, b: any) => a.proposed_date < b.proposed_date ? -1 : 1),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Abstimmungen</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedGames([]); setGameSearch(''); setNewNote('')
            setNewDate(''); setNewFrom(''); setNewUntil(''); setOverlapSuggestion(null)
            setNewMin(group.min_participants)
          }
        }}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Termin vorschlagen</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen Termin vorschlagen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label htmlFor="date">Datum *</Label>
                <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="from">Von</Label>
                  <Input id="from" type="time" value={newFrom} onChange={(e) => { setNewFrom(e.target.value); setOverlapSuggestion(null) }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="until">Bis</Label>
                  <Input id="until" type="time" value={newUntil} onChange={(e) => { setNewUntil(e.target.value); setOverlapSuggestion(null) }} />
                </div>
              </div>
              {overlapSuggestion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 -mt-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  Gemeinsames Zeitfenster: {overlapSuggestion.from}–{overlapSuggestion.until} Uhr (automatisch eingetragen, anpassbar)
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="min">Mindest-Teilnehmer</Label>
                <Input id="min" type="number" min={2} max={20} value={newMin} onChange={(e) => setNewMin(Number(e.target.value))} />
              </div>

              {/* Notiz */}
              <div className="space-y-1">
                <Label htmlFor="note">Notiz <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <textarea
                  id="note"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="z.B. Spieleabend bei mir zuhause…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Spiele vorschlagen */}
              <div className="space-y-2">
                <Label>Spiele vorschlagen <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {selectedGames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGames.map(g => (
                      <span key={g.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        {g.name}
                        <button type="button" onClick={() => toggleGame(g)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {hasPublicProfileCollection && (
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={searchMode === 'collection'}
                        onChange={(e) => {
                          setSearchMode(e.target.checked ? 'collection' : 'all')
                          setGameSearch('')
                          setAllGameResults([])
                        }}
                        className="h-4 w-4"
                      />
                      Eigene Spiele verwenden (sonst alle Spiele)
                    </label>
                  )}

                  <div className="flex gap-2">
                  <Input
                    placeholder={searchMode === 'collection' ? 'Eigene Sammlung durchsuchen…' : 'Alle Spiele durchsuchen oder Namen eingeben…'}
                    value={gameSearch}
                    onChange={e => setGameSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (visibleResults.length === 0 && canAddManual) addManualGame() } }}
                    autoComplete="off"
                  />
                  {canAddManual && visibleResults.length === 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={addManualGame} className="shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                </div>
                {searchingAllGames && searchMode === 'all' && gameSearch.trim() && (
                  <p className="text-xs text-muted-foreground">Suche in BGG…</p>
                )}
                {(visibleResults.length > 0 || canAddManual) && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {visibleResults.map(item => {
                      const isSelected = selectedGames.some(g => g.id === item.id)
                      return (
                        <button key={item.id} type="button" onClick={() => toggleGame(item)}
                          className={cn('w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors', isSelected && 'bg-primary/5 font-medium')}>
                          {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="h-7 w-7 object-cover rounded shrink-0" />}
                          <span className="flex-1 truncate">{item.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                    {canAddManual && (
                      <button type="button" onClick={addManualGame}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors text-muted-foreground">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="truncate">„{gameSearch.trim()}" manuell hinzufügen</span>
                      </button>
                    )}
                  </div>
                )}
                <div className="pt-1">
                  <img
                    src="/powered-by-bgg.webp"
                    alt="Powered by BoardGameGeek"
                    className="h-5 w-auto opacity-80"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Vorschlagen…' : 'Abstimmung starten'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allEvents.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Noch keine Abstimmungen</p>
          <p className="text-xs mt-1">Schlage einen Termin vor!</p>
        </div>
      )}

      {allEvents.map((event: any) => {
        const myResponse = event.event_responses?.find((r: any) => r.user_id === currentUserId)
        const accepted = event.event_responses?.filter((r: any) => r.response === 'accepted') ?? []
        const declined = event.event_responses?.filter((r: any) => r.response === 'declined') ?? []
        const uncertain = event.event_responses?.filter((r: any) => r.response === 'uncertain') ?? []
        const games = event.event_games ?? []
        const isThresholdMet = accepted.length >= event.min_participants
        const canStillSucceed = (accepted.length + uncertain.length) >= event.min_participants
        const changedParticipants = (event.event_responses ?? []).filter(
          (r: any) => r.previous_response === 'accepted' && r.response !== 'accepted'
        )
        const hasChangedAccepted = event.status === 'confirmed' && changedParticipants.length > 0
        const canDelete = event.status === 'voting' && event.proposed_by === currentUserId
        const isCancelled = event.status === 'cancelled'
        const canSoftDelete = event.status === 'confirmed' && event.proposed_by === currentUserId && hasChangedAccepted

        const borderClass = isCancelled
          ? 'border-border'
          : event.status === 'confirmed'
            ? (hasChangedAccepted
              ? (isThresholdMet ? 'border-amber-500 border-2' : 'border-red-500 border-2')
              : 'border-green-500 border-2')
            : (isThresholdMet
              ? 'border-green-500 border-2'
              : canStillSucceed
                ? 'border-border'
                : 'border-red-500 border-2')

        return (
          <Card key={event.id} className={cn(borderClass, isCancelled && 'opacity-60 bg-muted/30')}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">
                    {format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de })}
                  </CardTitle>
                  {event.from_time && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.from_time.slice(0,5)}{event.until_time ? `–${event.until_time.slice(0,5)}` : ''} Uhr
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vorgeschlagen von {event.profiles?.display_name}
                  </p>
                  {event.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">„{event.notes}"</p>
                  )}
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <div className="text-right">
                    <span className={cn('text-sm font-bold', isThresholdMet ? 'text-green-600' : 'text-muted-foreground')}>
                      {accepted.length}
                    </span>
                    <span className="text-xs text-muted-foreground">/{event.min_participants} nötig</span>
                  </div>
                  {isCancelled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground">Abgesagt</Badge>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: event.id, label: format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de }) })}
                      className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Abstimmung löschen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canSoftDelete && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget({ id: event.id, label: format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de }) })}
                      className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      aria-label="Termin absagen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {games.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {games.map((game: any) => (
                    <div key={game.id} className="space-y-1">
                      {game.thumbnail_url ? (
                        <img
                          src={game.thumbnail_url}
                          alt={game.name}
                          className="aspect-[3/4] w-full rounded object-cover"
                        />
                      ) : (
                        <div className="aspect-[3/4] w-full rounded bg-muted flex items-center justify-center px-1">
                          <span className="text-[10px] leading-tight text-center text-muted-foreground line-clamp-3">
                            {game.name}
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate">{game.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Warnhinweise */}
              {hasChangedAccepted && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {changedParticipants.length === 1
                      ? '1 Teilnehmer hat seine Verfügbarkeit wieder verändert.'
                      : `${changedParticipants.length} Teilnehmer haben ihre Verfügbarkeit wieder verändert.`
                    }{' '}Bitte prüfen!
                  </span>
                </div>
              )}
              {hasChangedAccepted && !isThresholdMet && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span>Die Mindestteilnehmerzahl wurde durch Änderungen unterschritten. Bitte prüfen!</span>
                </div>
              )}

              {/* Teilnehmer-Übersicht */}
              <div className="flex flex-wrap gap-1">
                {accepted.map((r: any) => (
                  <Badge key={r.user_id} variant="default" className="bg-green-500 text-xs">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {uncertain.filter((r: any) => r.previous_response === 'accepted').map((r: any) => (
                  <Badge key={r.user_id} variant="outline" className="text-red-600 border-yellow-400 text-xs font-semibold">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {uncertain.filter((r: any) => r.previous_response !== 'accepted').map((r: any) => (
                  <Badge key={r.user_id} variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {declined.filter((r: any) => r.previous_response === 'accepted').map((r: any) => (
                  <Badge key={r.user_id} className="bg-red-500 text-white text-xs font-semibold">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {declined.filter((r: any) => r.previous_response !== 'accepted').map((r: any) => (
                  <Badge key={r.user_id} variant="outline" className="text-muted-foreground text-xs line-through">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
              </div>

              {/* Eigene Antwort-Buttons (nicht bei abgesagten Terminen) */}
              {!isCancelled && <div className="grid grid-cols-3 gap-2">
                {(['accepted', 'uncertain', 'declined'] as const).map((resp) => {
                  const { label, icon: Icon, color } = RESPONSE_LABELS[resp]
                  const isActive = myResponse?.response === resp
                  const isLoading = loading === event.id + resp
                  return (
                    <button
                      key={resp}
                      onClick={() => handleResponse(event.id, resp)}
                      disabled={!!loading}
                      className={cn(
                        'rounded-lg p-2 text-xs font-medium border-2 transition-all flex flex-col items-center gap-1',
                        isActive
                          ? resp === 'accepted' ? 'bg-green-500 text-white border-green-600'
                            : resp === 'uncertain' ? 'bg-yellow-400 text-black border-yellow-500'
                              : 'bg-red-100 text-red-700 border-red-300'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', !isActive && color)} />
                      {isLoading ? '…' : label}
                    </button>
                  )
                })}
              </div>}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Termin absagen?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Der bestätigte Termin{cancelTarget ? ` vom ${cancelTarget.label}` : ''} wird als abgesagt markiert. Alle Mitglieder werden benachrichtigt. Der Termin bleibt bis zum Datum sichtbar (ausgegraut).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={loading !== null}>
                Abbrechen
              </Button>
              <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={handleSoftCancel} disabled={loading !== null}>
                Termin absagen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abstimmung löschen?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Die Abstimmung{deleteTarget ? ` vom ${deleteTarget.label}` : ''} wird vollständig entfernt, inklusive Spiele und Antworten.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={loading !== null}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleDeleteEvent} disabled={loading !== null}>
                Löschen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
