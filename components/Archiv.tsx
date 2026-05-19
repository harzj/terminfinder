'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface BggResult {
  id: number
  name: string
  year?: number
}

interface Game {
  id: string
  bgg_id: number
  name: string
  thumbnail_url: string | null
  added_by: string | null
}

interface PastEvent {
  id: string
  proposed_date: string
  from_time: string | null
  until_time: string | null
  event_responses: Array<{ response: string }>
  event_games: Game[]
}

interface Props {
  pastEvents: PastEvent[]
  currentUserId: string
}

// ── Long-Press-Hook ──────────────────────────────────────────
function useLongPress(onLongPress: () => void, ms = 600) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    timerRef.current = setTimeout(onLongPress, ms)
  }, [onLongPress, ms])

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onLongPress() },
  }
}

// ── Einzelnes Spiel-Poster ───────────────────────────────────
interface GamePosterProps {
  game: Game
  isSelected: boolean
  onLongPress: () => void
  onDelete: () => void
  onCancel: () => void
}

function GamePoster({ game, isSelected, onLongPress, onDelete, onCancel }: GamePosterProps) {
  const longPress = useLongPress(onLongPress)

  return (
    <div
      className="relative rounded overflow-hidden cursor-pointer select-none"
      {...longPress}
    >
      {game.thumbnail_url ? (
        <img
          src={game.thumbnail_url}
          alt={game.name}
          className="w-full aspect-[3/4] object-cover rounded"
          draggable={false}
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-muted rounded flex items-center justify-center p-1">
          <span className="text-[10px] text-muted-foreground text-center leading-tight">{game.name}</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 truncate">{game.name}</p>

      {isSelected && (
        <div className="absolute inset-0 rounded bg-black/65 flex flex-col items-center justify-center gap-2">
          <button
            className="text-white text-xs font-medium bg-destructive rounded px-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            Entfernen
          </button>
          <button
            className="text-white/70 text-xs"
            onClick={(e) => { e.stopPropagation(); onCancel() }}
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}

// ── Archiv-Hauptkomponente ───────────────────────────────────
export default function Archiv({ pastEvents, currentUserId }: Props) {
  const [gamesMap, setGamesMap] = useState<Record<string, Game[]>>(() => {
    const map: Record<string, Game[]> = {}
    for (const e of pastEvents) { map[e.id] = e.event_games ?? [] }
    return map
  })

  const [openDialogEventId, setOpenDialogEventId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BggResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [selectedGame, setSelectedGame] = useState<{ eventId: string; gameId: string } | null>(null)

  // Debounced BGG-Suche
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bgg?q=${encodeURIComponent(searchQuery.trim())}`)
        if (res.ok) setSearchResults(await res.json())
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => { clearTimeout(timer); setIsSearching(false) }
  }, [searchQuery])

  const closeDialog = () => {
    setOpenDialogEventId(null)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleAddGame = async (bggResult: BggResult) => {
    if (!openDialogEventId || addingId !== null) return
    setAddingId(bggResult.id)
    const eventId = openDialogEventId
    try {
      const detailRes = await fetch(`/api/bgg?id=${bggResult.id}`)
      const detail = detailRes.ok ? await detailRes.json() : null

      const supabase = createClient()
      const { data, error } = await supabase
        .from('event_games')
        .insert({
          event_id: eventId,
          bgg_id: bggResult.id,
          name: bggResult.name,
          thumbnail_url: detail?.thumbnail ?? null,
          added_by: currentUserId,
        })
        .select()
        .single()

      if (!error && data) {
        setGamesMap(prev => ({ ...prev, [eventId]: [...(prev[eventId] ?? []), data] }))
      }
    } finally {
      setAddingId(null)
      closeDialog()
    }
  }

  const handleDeleteGame = async (eventId: string, gameId: string) => {
    setGamesMap(prev => ({ ...prev, [eventId]: (prev[eventId] ?? []).filter(g => g.id !== gameId) }))
    setSelectedGame(null)
    const supabase = createClient()
    await supabase.from('event_games').delete().eq('id', gameId)
  }

  if (pastEvents.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">Noch keine vergangenen Termine.</p>
  }

  return (
    <>
      <div className="space-y-3" onClick={() => setSelectedGame(null)}>
        {pastEvents.map(event => {
          const games = gamesMap[event.id] ?? []
          const accepted = (event.event_responses ?? []).filter(r => r.response === 'accepted').length

          return (
            <div key={event.id} className="rounded-lg border border-border p-3 space-y-3">
              {/* Termin-Kopfzeile */}
              <div>
                <p className="font-medium text-sm">
                  {format(parseISO(event.proposed_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                </p>
                {event.from_time && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.from_time.slice(0, 5)}{event.until_time ? ` – ${event.until_time.slice(0, 5)}` : ''} Uhr
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{accepted} Zusagen</p>
              </div>

              {/* Spiele-Poster-Grid */}
              {games.length > 0 && (
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                  onClick={e => e.stopPropagation()}
                >
                  {games.map(game => (
                    <GamePoster
                      key={game.id}
                      game={game}
                      isSelected={selectedGame?.eventId === event.id && selectedGame?.gameId === game.id}
                      onLongPress={() => setSelectedGame({ eventId: event.id, gameId: game.id })}
                      onDelete={() => handleDeleteGame(event.id, game.id)}
                      onCancel={() => setSelectedGame(null)}
                    />
                  ))}
                </div>
              )}

              {/* Spiel hinzufügen */}
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedGame(null)
                  setOpenDialogEventId(event.id)
                  setSearchQuery('')
                  setSearchResults([])
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Spiel hinzufügen
              </button>
            </div>
          )
        })}
      </div>

      {/* Spiel-Suche-Dialog */}
      <Dialog open={openDialogEventId !== null} onOpenChange={open => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Spiel hinzufügen</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Spieltitel suchen…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />

          {isSearching && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto -mx-1 space-y-0.5">
              {searchResults.map(result => (
                <button
                  key={result.id}
                  className="w-full text-left px-3 py-2.5 rounded hover:bg-muted text-sm flex items-center justify-between gap-2 disabled:opacity-50"
                  disabled={addingId !== null}
                  onClick={() => handleAddGame(result)}
                >
                  <span className="truncate">{result.name}{result.year ? ` (${result.year})` : ''}</span>
                  {addingId === result.id && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse gefunden</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
