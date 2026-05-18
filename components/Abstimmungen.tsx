'use client'

import { useState } from 'react'
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
import { CheckCircle2, XCircle, HelpCircle, Plus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  group: any
  events: any[]
  currentUserId: string
  members: any[]
}

const RESPONSE_LABELS = {
  accepted: { label: 'Zugesagt', icon: CheckCircle2, color: 'text-green-600' },
  declined: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500' },
  uncertain: { label: 'Unklar', icon: HelpCircle, color: 'text-yellow-500' },
}

export default function Abstimmungen({ group, events, currentUserId, members }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newFrom, setNewFrom] = useState('')
  const [newUntil, setNewUntil] = useState('')
  const [newMin, setNewMin] = useState(group.min_participants)
  const [creating, setCreating] = useState(false)

  const handleResponse = async (eventId: string, response: 'accepted' | 'declined' | 'uncertain') => {
    setLoading(eventId + response)
    const supabase = createClient()
    await supabase.from('event_responses').upsert(
      { event_id: eventId, user_id: currentUserId, response, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' }
    )
    setLoading(null)
    router.refresh()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDate) return
    setCreating(true)
    const supabase = createClient()
    await supabase.from('events').insert({
      group_id: group.id,
      proposed_date: newDate,
      from_time: newFrom || null,
      until_time: newUntil || null,
      min_participants: newMin,
      proposed_by: currentUserId,
    })
    setCreating(false)
    setDialogOpen(false)
    router.refresh()
  }

  const votingEvents = events.filter((e: any) => e.status === 'voting')
  const confirmedEvents = events.filter((e: any) => e.status === 'confirmed')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Abstimmungen</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <Label htmlFor="from">Von (optional)</Label>
                  <Input id="from" type="time" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="until">Bis (optional)</Label>
                  <Input id="until" type="time" value={newUntil} onChange={(e) => setNewUntil(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="min">Mindest-Teilnehmer</Label>
                <Input id="min" type="number" min={2} max={20} value={newMin} onChange={(e) => setNewMin(Number(e.target.value))} />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Vorschlagen…' : 'Abstimmung starten'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {confirmedEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-green-700">Bestätigte Termine</h3>
          {confirmedEvents.map((event: any) => (
            <Card key={event.id} className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm">
                    {format(parseISO(event.proposed_date), 'EEEE, d. MMMM', { locale: de })}
                    {event.from_time && ` · ${event.from_time.slice(0,5)}${event.until_time ? `–${event.until_time.slice(0,5)}` : ''} Uhr`}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {event.event_responses?.filter((r: any) => r.response === 'accepted').length} Zusagen
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {votingEvents.length === 0 && confirmedEvents.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Noch keine Abstimmungen</p>
          <p className="text-xs mt-1">Schlage einen Termin vor!</p>
        </div>
      )}

      {votingEvents.map((event: any) => {
        const myResponse = event.event_responses?.find((r: any) => r.user_id === currentUserId)
        const accepted = event.event_responses?.filter((r: any) => r.response === 'accepted') ?? []
        const declined = event.event_responses?.filter((r: any) => r.response === 'declined') ?? []
        const uncertain = event.event_responses?.filter((r: any) => r.response === 'uncertain') ?? []

        return (
          <Card key={event.id}>
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
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-green-600">{accepted.length}</span>
                  <span className="text-xs text-muted-foreground">/{event.min_participants} nötig</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Teilnehmer-Übersicht */}
              <div className="flex flex-wrap gap-1">
                {accepted.map((r: any) => (
                  <Badge key={r.user_id} variant="default" className="bg-green-500 text-xs">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {uncertain.map((r: any) => (
                  <Badge key={r.user_id} variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
                {declined.map((r: any) => (
                  <Badge key={r.user_id} variant="outline" className="text-muted-foreground text-xs line-through">
                    {r.profiles?.display_name}
                  </Badge>
                ))}
              </div>

              {/* Eigene Antwort-Buttons */}
              <div className="grid grid-cols-3 gap-2">
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
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
