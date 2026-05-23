'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'
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
  bggUsername: string | null
  bggCollection: Array<{ id: number; name: string; thumbnail_url: string | null }> | null
}

export default function GruppenDetailClient({
  group, members, availabilities, events, pastEvents, currentUserId, startDate, endDate, blockedDates, bggUsername, bggCollection
}: Props) {
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
        <Link href={`/gruppen/${group.id}/einstellungen`}>
          <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="uebersicht" className="flex-1">
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
