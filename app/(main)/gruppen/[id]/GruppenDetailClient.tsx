'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ArrowLeft, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GruppenUebersicht from '@/components/GruppenUebersicht'
import Abstimmungen from '@/components/Abstimmungen'
import NaechsteTermine from '@/components/NaechsteTermine'
import Archiv from '@/components/Archiv'

interface Props {
  group: any
  members: any[]
  availabilities: any[]
  events: any[]
  pastEvents: any[]
  currentUserId: string
  startDate: string
  endDate: string
  blockedDates: string[]
  betterGroupByDate: Record<string, string>
  bggUsername: string | null
  bggCollection: Array<{ id: number; name: string; thumbnail_url: string | null }> | null
}

export default function GruppenDetailClient({
  group, members, availabilities, events, pastEvents, currentUserId, startDate, endDate, blockedDates, betterGroupByDate, bggUsername, bggCollection
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const isCreator = group.created_by === currentUserId

  const handleLeaveGroup = async () => {
    setLeaving(true)
    const supabase = createClient()
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', currentUserId)
    router.push('/gruppen')
  }
  const requestedTab = searchParams.get('tab')
  const defaultTab = requestedTab === 'abstimmungen' || requestedTab === 'naechste' || requestedTab === 'archiv'
    ? requestedTab
    : 'uebersicht'
  const votingCount = events.filter((e: any) => e.status === 'voting').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-background sticky top-0 z-10">
        <Link href="/gruppen" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{group.name}</h1>
          <p className="text-xs text-muted-foreground">{members.length} Mitglieder · min. {group.min_participants} Personen</p>
        </div>
        {!isCreator && (
          <button
            onClick={() => setLeaveDialogOpen(true)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Gruppe verlassen"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
        {isCreator && (
          <Link href={`/gruppen/${group.id}/einstellungen`}>
            <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </Link>
        )}
      </div>

      {/* Bestätigungsdialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppe verlassen?</DialogTitle>
            <DialogDescription>
              Du verlässt <strong>{group.name}</strong>. Du kannst nur über einen neuen Einladungslink wieder beitreten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} disabled={leaving}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleLeaveGroup} disabled={leaving}>
              {leaving ? 'Verlasse...' : 'Gruppe verlassen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="flex-1">
        <TabsList className="w-full rounded-none border-b border-border bg-background h-auto p-0">
          <TabsTrigger value="uebersicht" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="abstimmungen" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3 relative">
            Abstimmungen
            {votingCount > 0 && (
              <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {votingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="naechste" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            Nächste
          </TabsTrigger>
          <TabsTrigger value="archiv" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            Archiv
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="p-4 mt-0">
          <GruppenUebersicht
            members={members}
            availabilities={availabilities}
            events={events}
            startDate={startDate}
            endDate={endDate}
            blockedDates={blockedDates}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="abstimmungen" className="p-4 mt-0">
          <Abstimmungen
            group={group}
            events={events}
            currentUserId={currentUserId}
            members={members}
            availabilities={availabilities}
            bggUsername={bggUsername}
            bggCollection={bggCollection}
          />
        </TabsContent>

        <TabsContent value="naechste" className="p-4 mt-0">
          <NaechsteTermine
            group={group}
            availabilities={availabilities}
            members={members}
            startDate={startDate}
            endDate={endDate}
            currentUserId={currentUserId}
            events={events}
            blockedDates={blockedDates}
            betterGroupByDate={betterGroupByDate}
            bggUsername={bggUsername}
            bggCollection={bggCollection}
          />
        </TabsContent>

        <TabsContent value="archiv" className="p-4 mt-0">
          <Archiv
            pastEvents={pastEvents}
            currentUserId={currentUserId}
            groupId={group.id}
            minParticipants={group.min_participants ?? 2}
            bggUsername={bggUsername}
            bggCollection={bggCollection}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
