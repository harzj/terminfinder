'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { computeOverlaps } from '@/lib/overlap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarCheck, Plus, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BggCollectionItem { id: number; name: string; thumbnail_url: string | null }
interface BggSearchItem { id: number; name: string; year?: number; thumbnail_url: string | null }

interface Props {
  group: any
  availabilities: any[]
  members: any[]
  startDate: string
  endDate: string
  currentUserId: string
  events: any[]
  blockedDates?: string[]
  bggUsername?: string | null
  bggCollection?: Array<{ id: number; name: string; thumbnail_url: string | null }> | null
}

export default function NaechsteTermine({ group, availabilities, members, startDate, endDate, currentUserId, events, blockedDates, bggUsername, bggCollection }: Props) {
  const router = useRouter()

  // Dialog-State für den Vorschlagen-Dialog
  type OverlapItem = ReturnType<typeof computeOverlaps>[0]
  const [sortIndex, setSortIndex] = useState<0 | 1 | 2>(0)

  const [dialogOverlap, setDialogOverlap] = useState<OverlapItem | null>(null)
  const [dialogFrom, setDialogFrom] = useState('')
  const [dialogUntil, setDialogUntil] = useState('')
  const [dialogNote, setDialogNote] = useState('')
  const [dialogMin, setDialogMin] = useState(group.min_participants)
  const [selectedGames, setSelectedGames] = useState<BggCollectionItem[]>([])
  const [gameSearch, setGameSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'collection' | 'all'>('all')
  const [allGameResults, setAllGameResults] = useState<BggSearchItem[]>([])
  const [searchingAllGames, setSearchingAllGames] = useState(false)
  const [creating, setCreating] = useState(false)

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

  const toggleGame = (item: BggCollectionItem) =>
    setSelectedGames(prev => prev.some(g => g.id === item.id) ? prev.filter(g => g.id !== item.id) : [...prev, item])

  const addManualGame = () => {
    const name = gameSearch.trim()
    if (!name) return
    setSelectedGames(prev => [...prev, { id: -(Date.now()), name, thumbnail_url: null }])
    setGameSearch('')
  }

  const existingVotingDates = useMemo(
    () => new Set((events ?? []).filter((e: any) => e.status === 'voting').map((e: any) => e.proposed_date as string)),
    [events]
  )
  const blockedDateSet = useMemo(() => new Set(blockedDates ?? []), [blockedDates])
  const todayStr = new Date().toISOString().split('T')[0]

  const overlaps = useMemo(() => {
    const memberProfiles = members.map((m: any) => ({
      id: m.user_id,
      display_name: m.display_name ?? m.profiles?.display_name ?? m.email?.split('@')[0] ?? '?',
    }))
    const enriched = availabilities.map((a: any) => ({
      ...a,
      profiles: { display_name: a.profiles?.display_name ?? '?' },
    }))
    return computeOverlaps(
      enriched, memberProfiles as any, group.min_participants, parseISO(startDate), parseISO(endDate)
    ).filter(o => o.date >= todayStr && !existingVotingDates.has(o.date) && !blockedDateSet.has(o.date))
  }, [availabilities, members, group.min_participants, startDate, endDate, existingVotingDates, blockedDateSet, todayStr])

  const sortedOverlaps = useMemo(() => {
    const sorted = [...overlaps]
    if (sortIndex === 1) {
      // Zustimmung: confirmed DESC → uncertain DESC → date ASC
      sorted.sort((a, b) => {
        if (b.confirmed_participants.length !== a.confirmed_participants.length)
          return b.confirmed_participants.length - a.confirmed_participants.length
        if (b.uncertain_participants.length !== a.uncertain_participants.length)
          return b.uncertain_participants.length - a.uncertain_participants.length
        return a.date < b.date ? -1 : 1
      })
    } else if (sortIndex === 2) {
      // Potential: (confirmed+uncertain) DESC → confirmed DESC → date ASC
      sorted.sort((a, b) => {
        const potA = a.confirmed_participants.length + a.uncertain_participants.length
        const potB = b.confirmed_participants.length + b.uncertain_participants.length
        if (potB !== potA) return potB - potA
        if (b.confirmed_participants.length !== a.confirmed_participants.length)
          return b.confirmed_participants.length - a.confirmed_participants.length
        return a.date < b.date ? -1 : 1
      })
    }
    // sortIndex === 0 (Datum): computeOverlaps already returns chronological order
    return sorted.slice(0, 10)
  }, [overlaps, sortIndex])

  const openDialog = (overlap: OverlapItem) => {
    setDialogOverlap(overlap)
    setDialogFrom(overlap.from_time !== '15:00' ? overlap.from_time.slice(0, 5) : '')
    setDialogUntil(overlap.until_time !== '24:00' ? overlap.until_time.slice(0, 5) : '')
    setDialogNote('')
    setDialogMin(group.min_participants)
    setSelectedGames([])
    setGameSearch('')
  }

  const closeDialog = () => { setDialogOverlap(null); setSelectedGames([]); setGameSearch(''); setDialogNote('') }

  const handleCreate = async () => {
    if (!dialogOverlap || creating) return
    setCreating(true)
    const supabase = createClient()
    const { data: event } = await supabase.from('events').insert({
      group_id: group.id,
      proposed_date: dialogOverlap.date,
      from_time: dialogFrom || null,
      until_time: dialogUntil || null,
      min_participants: dialogMin,
      proposed_by: currentUserId,
      notes: dialogNote.trim() || null,
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
    setCreating(false)
    closeDialog()
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
    <>
      <div className="space-y-3">
        {/* Sortier-Schieberegler */}
        <div className="space-y-1 pb-1">
          <div className="flex justify-between text-xs font-medium">
            <span className={sortIndex === 0 ? 'text-primary' : 'text-muted-foreground'}>Datum</span>
            <span className={sortIndex === 1 ? 'text-primary' : 'text-muted-foreground'}>Zustimmung</span>
            <span className={sortIndex === 2 ? 'text-primary' : 'text-muted-foreground'}>Potential</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={sortIndex}
            onChange={e => setSortIndex(Number(e.target.value) as 0 | 1 | 2)}
            className="w-full accent-primary cursor-pointer"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Tage, an denen mindestens {group.min_participants} Mitglieder verfügbar sind:
        </p>
        {sortedOverlaps.map((overlap) => (
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
              <div className="flex flex-wrap gap-1 items-center">
                {overlap.confirmed_participants.map((p) => (
                  <span key={p.id} className="w-4 h-4 rounded-full bg-green-500 inline-block" title={p.display_name} />
                ))}
                {overlap.uncertain_participants.map((p) => (
                  <span key={p.id} className="w-4 h-4 rounded-full bg-yellow-400 inline-block" title={p.display_name} />
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => openDialog(overlap)}>
                Als Abstimmung vorschlagen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vorschlagen-Dialog mit Zeitfenster, Notiz und Spielen */}
      <Dialog open={!!dialogOverlap} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogOverlap && format(parseISO(dialogOverlap.date), 'EEEE, d. MMMM', { locale: de })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nf">Von</Label>
                <Input id="nf" type="time" value={dialogFrom} onChange={e => setDialogFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nu">Bis</Label>
                <Input id="nu" type="time" value={dialogUntil} onChange={e => setDialogUntil(e.target.value)} />
              </div>
            </div>
            {dialogOverlap && (
              <p className="text-xs text-muted-foreground -mt-2">
                Gemeinsames Fenster: {dialogOverlap.from_time}–{dialogOverlap.until_time} Uhr
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="nmin">Mindest-Teilnehmer</Label>
              <Input id="nmin" type="number" min={2} max={20} value={dialogMin} onChange={e => setDialogMin(Number(e.target.value))} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="nnote">Notiz <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                id="nnote"
                value={dialogNote}
                onChange={e => setDialogNote(e.target.value)}
                placeholder="z.B. Spieleabend bei mir zuhause…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label>Spiele vorschlagen <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {selectedGames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedGames.map(g => (
                    <span key={g.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {g.name}
                      <button type="button" onClick={() => toggleGame(g)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
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

            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? 'Wird vorgeschlagen…' : 'Abstimmung starten'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
