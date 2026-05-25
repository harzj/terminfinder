import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

import { useEffect } from 'react'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Permission erst nach Login fragen
      const user = window.localStorage.getItem('tf_logged_in')
      if (user) {
        Notification.requestPermission()
      }
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto w-full max-w-[560px]">
        <Image
          src="/header.png"
          alt="Terminfinder"
          width={1600}
          height={400}
          priority
          className="block h-auto w-full"
        />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
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
  )
}
