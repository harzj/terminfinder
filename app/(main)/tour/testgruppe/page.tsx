import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TourTestgruppeClient from './TourTestgruppeClient'

export default async function TourTestgruppePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/anmelden')

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div id="tour-testgroup-overview">
        <h1 className="text-xl font-bold">Tour-Testgruppe</h1>
        <p className="text-sm text-muted-foreground">Hier kannst du die Gruppenansicht gefahrlos ausprobieren.</p>
      </div>
      <div id="tour-testgroup-tabs" className="sr-only">Tabs für Übersicht, Abstimmungen, Nächste und Archiv</div>
      <TourTestgruppeClient />
    </div>
  )
}
