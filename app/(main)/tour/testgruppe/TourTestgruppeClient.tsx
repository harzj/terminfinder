'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function TourTestgruppeClient() {
  const router = useRouter()

  const finishTour = async () => {
    await fetch('/api/profile/onboarding-tour', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seen: true }),
    })
    router.push('/verfuegbarkeit')
    router.refresh()
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Button id="tour-testgroup-finish" className="w-full" onClick={finishTour}>
        Tour beenden und zurück zur Verfügbarkeit
      </Button>
    </div>
  )
}
