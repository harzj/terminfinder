import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, ChevronRight } from 'lucide-react'
import DemoGruppeButton from './DemoGruppeButton'
import JoinByCodeInput from './JoinByCodeInput'

export default async function GruppenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const groupIds = (memberships ?? []).map((m: any) => m.group_id)

  const { data: groupData } = groupIds.length > 0
    ? await supabase
        .from('groups')
        .select('id, name, description, min_participants, created_by')
        .in('id', groupIds)
    : { data: [] as any[] }

  const groups = groupData ?? []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Meine Gruppen</h1>
        <Link href="/gruppen/neu" className={buttonVariants({ size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1" /> Neu
        </Link>
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Per Code beitreten</p>
        <JoinByCodeInput />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Gruppen</p>
          <p className="text-sm mt-1">Erstelle eine Gruppe oder nimm eine Einladung an.</p>
          <div className="flex flex-col items-center gap-2 mt-4">
            <Link href="/gruppen/neu" className={buttonVariants()}>
              Gruppe erstellen
            </Link>
            <DemoGruppeButton />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group: any) => (
            <Link key={group.id} href={`/gruppen/${group.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {group.description && (
                    <CardDescription className="text-xs">{group.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Mindest-Teilnehmer: {group.min_participants}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
