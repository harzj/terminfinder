'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

const DISMISSED_KEY = 'tf_push_banner_dismissed'

export default function PushBanner() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISSED_KEY) === '1') return
    setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  const handleActivate = async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await subscribeToPush()
        setDone(true)
        setTimeout(() => setVisible(false), 2500)
      } else {
        dismiss()
      }
    } catch (e) {
      console.warn('Push-Aktivierung fehlgeschlagen', e)
      dismiss()
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/70 border-b border-border text-sm">
      {done ? (
        <>
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          <span className="flex-1 text-sm">Benachrichtigungen aktiviert!</span>
        </>
      ) : (
        <>
          <Bell className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 leading-tight">
            Keine Neuigkeit verpassen –{' '}
            <Link href="/profil" className="underline underline-offset-2" onClick={dismiss}>
              Push-Benachrichtigungen
            </Link>{' '}
            aktivieren.
          </span>
          <Button
            size="sm"
            className="shrink-0 h-7 text-xs px-2"
            onClick={handleActivate}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Jetzt'}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={dismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}
