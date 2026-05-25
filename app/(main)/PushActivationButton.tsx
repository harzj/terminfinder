'use client'

import { useState } from 'react'
import { Bell, BellRing, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

async function subscribeToPush() {
  await navigator.serviceWorker.register('/service-worker.js')
  const registration = await navigator.serviceWorker.ready
  const res = await fetch('/api/push/vapid-key')
  if (!res.ok) throw new Error('VAPID key nicht verfügbar')
  const { key } = await res.json()
  const padding = '='.repeat((4 - (key.length % 4)) % 4)
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const appKey = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) appKey[i] = raw.charCodeAt(i)
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appKey.buffer as ArrayBuffer,
  })
  const saveRes = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!saveRes.ok) throw new Error(`Server: ${saveRes.status}`)
}

export default function PushActivationButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle')

  const handleClick = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (status === 'loading' || status === 'done') return
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await subscribeToPush()
        setStatus('done')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('denied')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('idle')
    }
  }

  const icon = status === 'loading'
    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
    : status === 'done'
    ? <Check className="h-3.5 w-3.5 text-green-500" />
    : status === 'denied'
    ? <Bell className="h-3.5 w-3.5 text-destructive" />
    : <BellRing className="h-3.5 w-3.5" />

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 ml-auto shrink-0"
      onClick={handleClick}
      title={
        status === 'done' ? 'Aktiviert!'
        : status === 'denied' ? 'Benachrichtigungen blockiert'
        : 'Push-Benachrichtigungen aktivieren'
      }
    >
      {icon}
    </Button>
  )
}
