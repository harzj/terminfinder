'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TourStep = {
  path: string
  targetId: string
  title: string
  body: string
  nextLabel?: string
}

const STEPS: TourStep[] = [
  {
    path: '/verfuegbarkeit',
    targetId: 'tour-availability-intro',
    title: 'Willkommen bei der kurzen Tour',
    body: 'Du kannst die Tour jederzeit oben rechts mit dem X abbrechen. Wir starten hier auf deiner Verfügbarkeitsseite.',
    nextLabel: 'Weiter',
  },
  {
    path: '/verfuegbarkeit',
    targetId: 'tour-availability-grid',
    title: 'Verfügbarkeit per Klick',
    body: 'Mit einzelnen Klicks wechselst du von nicht verfügbar zu verfügbar, dann zu unklar und wieder zurück.',
  },
  {
    path: '/verfuegbarkeit',
    targetId: 'tour-availability-sheet',
    title: 'Genaue Zeiten per Langdruck',
    body: 'Halte einen Termin gedrückt, um genaue Uhrzeiten zu setzen.',
  },
  {
    path: '/verfuegbarkeit',
    targetId: 'tour-availability-lock',
    title: 'Sperrsymbol',
    body: 'Das Schloss verhindert versehentliche Klicks beim Scrollen.',
  },
  {
    path: '/verfuegbarkeit',
    targetId: 'tour-availability-import',
    title: 'Kalender importieren',
    body: 'Hier kannst du einen Link zu deinem Kalender hinterlegen, damit deine Verfügbarkeit automatisch synchronisiert wird.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-general',
    title: 'Profil-Einstellungen',
    body: 'Hier kannst du z. B. deinen BGG-Nutzernamen setzen oder festlegen, wie weit im Voraus du planst.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-bgg',
    title: 'BGG-Sammlung',
    body: 'Mit öffentlicher Sammlung kannst du Spiele direkt aus BoardGameGeek synchronisieren.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-groupnames',
    title: 'Name pro Gruppe',
    body: 'Hier legst du fest, wie du in einer einzelnen Gruppe angezeigt werden willst.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-times',
    title: 'Standard-Uhrzeiten',
    body: 'Diese Zeiten werden automatisch gesetzt, wenn du auf freie Termine klickst. Die App berechnet immer die größte Übereinstimmung in deiner Gruppe.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-calendar',
    title: 'Kalender-Integration',
    body: 'Wenn du diesen Link in deiner Kalender-App einträgst, werden Termine dort sichtbar.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-autosync',
    title: 'Auto-Sync',
    body: 'Eigene Kalender können automatisch mit deiner Verfügbarkeit synchronisiert werden. Das Feature ist noch in der Testphase.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-notifications',
    title: 'Benachrichtigungen',
    body: 'Hier aktivierst du Push-Nachrichten, damit du bei Terminänderungen informiert wirst.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-logout',
    title: 'Abmelden und Tour neu starten',
    body: 'Hier kannst du dich abmelden oder die Tour später erneut starten.',
  },
  {
    path: '/profil',
    targetId: 'tour-profile-restart',
    title: 'Tour neu starten',
    body: 'Über diesen Button kannst du die Einführung jederzeit erneut aktivieren.',
  },
  {
    path: '/gruppen',
    targetId: 'tour-groups-list',
    title: 'Gruppenübersicht',
    body: 'Hier siehst du deine Gruppen. Du kannst per Login-Link oder Code beitreten oder eigene Gruppen anlegen.',
  },
  {
    path: '/tour/testgruppe',
    targetId: 'tour-testgroup-overview',
    title: 'Testgruppe',
    body: 'Diese Testgruppe existiert nur für die Tour. Hier kannst du die Übersicht und unterschiedliche Planungshorizonte gefahrlos ansehen.',
    nextLabel: 'Zur Testgruppe',
  },
  {
    path: '/tour/testgruppe',
    targetId: 'tour-testgroup-tabs',
    title: 'Tabs wie in einer echten Gruppe',
    body: 'In der Tour-Testgruppe findest du dieselben Tabs wie in einer normalen Gruppe: Übersicht, Abstimmungen, Nächste und Archiv.',
  },
]

async function markTourSeen(seen: boolean) {
  await fetch('/api/profile/onboarding-tour', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seen }),
  })
}

export default function OnboardingTourGate({ userId, initialSeenAt }: { userId: string; initialSeenAt: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(initialSeenAt === null)
  const [stepIndex, setStepIndex] = useState(0)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const currentStep = useMemo(() => STEPS[Math.min(stepIndex, STEPS.length - 1)], [stepIndex])

  useEffect(() => {
    setOpen(initialSeenAt === null)
    if (initialSeenAt === null) setStepIndex(0)
  }, [initialSeenAt])

  useEffect(() => {
    if (!open) return
    if (pathname !== currentStep.path) {
      router.replace(currentStep.path)
    }
  }, [currentStep.path, open, pathname, router])

  useEffect(() => {
    if (!open) {
      setHighlightRect(null)
      return
    }
    const update = () => {
      const target = document.getElementById(currentStep.targetId)
      if (!target) {
        setHighlightRect(null)
        return
      }
      setHighlightRect(target.getBoundingClientRect())
    }
    const timer = window.setTimeout(update, 100)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [currentStep.targetId, open, pathname])

  const closeTour = async () => {
    setAdvancing(true)
    await markTourSeen(true)
    setOpen(false)
    setAdvancing(false)
    router.refresh()
  }

  const restartTour = async () => {
    setAdvancing(true)
    await markTourSeen(false)
    setOpen(true)
    setStepIndex(0)
    router.replace('/verfuegbarkeit')
    setAdvancing(false)
    router.refresh()
  }

  const handleNext = async () => {
    setAdvancing(true)
    if (stepIndex >= STEPS.length - 1) {
      await closeTour()
      router.push('/verfuegbarkeit')
      return
    }
    const nextStep = STEPS[stepIndex + 1]
    setStepIndex((value) => Math.min(value + 1, STEPS.length - 1))
    if (pathname !== nextStep.path) {
      router.push(nextStep.path)
    }
    setAdvancing(false)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/60" aria-hidden="true" />
      {highlightRect && (
        <div
          className="fixed z-[110] rounded-2xl ring-4 ring-amber-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
          style={{
            top: Math.max(8, highlightRect.top - 8),
            left: Math.max(8, highlightRect.left - 8),
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
          }}
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-[120] p-4 pb-6 pointer-events-none">
        <div className="relative mx-auto max-w-[560px] pointer-events-auto rounded-2xl border border-border bg-background p-4 shadow-xl">
          <button
            type="button"
            onClick={closeTour}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label="Tour abbrechen"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tutorial {stepIndex + 1}/{STEPS.length}</p>
          <h2 className="mt-1 text-base font-semibold">{currentStep.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{currentStep.body}</p>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleNext} className="flex-1" disabled={advancing}>
              {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{currentStep.nextLabel ?? 'Weiter'}</span><ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
            <Button variant="outline" onClick={restartTour} disabled={advancing}>Neustart</Button>
          </div>
        </div>
      </div>
    </>
  )
}
