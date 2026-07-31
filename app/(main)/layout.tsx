import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

import NotificationSetup from './NotificationSetup'
import PushBanner from './PushBanner'
import AutoSyncBanner from './AutoSyncBanner'
import OnboardingTourGate from '@/components/OnboardingTourGate'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('onboarding_tour_seen_at')
        .eq('id', user.id)
        .single()
    : { data: null as { onboarding_tour_seen_at: string | null } | null }

  return (
    <>
      <NotificationSetup />
      <div className="flex flex-col min-h-screen">
        <header className="shrink-0 border-b border-border bg-background">
          <div className="mx-auto w-full max-w-[560px]">
            <Image
              src="/header_v2.png"
              alt="Terminfinder"
              width={1600}
              height={400}
              priority
              className="block h-auto w-full"
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20">
          {user && (
            <OnboardingTourGate
              userId={user.id}
              initialSeenAt={profile?.onboarding_tour_seen_at ?? null}
            />
          )}
          <PushBanner />
          <AutoSyncBanner />
          {children}
        </main>
        <footer className="pb-20 border-t border-border/60 bg-background/95">
          <div className="mx-auto w-full max-w-[560px] px-4 py-3 text-xs text-muted-foreground flex items-center justify-center gap-4">
            <Link className="underline underline-offset-2" href="/impressum">Impressum</Link>
            <Link className="underline underline-offset-2" href="/datenschutz">Datenschutz</Link>
            <Link className="underline underline-offset-2" href="/hinweise">Hinweise</Link>
          </div>
        </footer>
        <BottomNav />
      </div>
    </>
  )
}
