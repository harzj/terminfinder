'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function AnmeldenForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
      return
    }
    const invite = searchParams.get('invite')
    if (invite) {
      router.push(/einladen/+invite)
    } else {
      router.push('/verfuegbarkeit')
    }
  }

  const invite = searchParams.get('invite')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Terminfinder</CardTitle>
          <CardDescription>Melde dich an, um deine Spieleabende zu planen</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Noch kein Konto?{' '}
            <Link href={invite ? /registrieren?invite=+invite : '/registrieren'} className="underline underline-offset-4">
              Registrieren
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnmeldenPage() {
  return (
    <Suspense>
      <AnmeldenForm />
    </Suspense>
  )
}