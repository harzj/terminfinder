'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function RegistrierenForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const invite = searchParams.get('invite')
    if (invite) {
      router.push(`/einladen/${invite}`)
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
          <CardDescription>Erstelle dein Konto</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Anzeigename</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" required autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" required autoComplete="new-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Konto erstellen...' : 'Konto erstellen'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Bereits ein Konto?{' '}
            <Link href={invite ? '/anmelden?invite=' + invite : '/anmelden'} className="underline underline-offset-4">
              Anmelden
            </Link>
          </p>
        </CardContent>
      </Card>

      <div className="mt-4 text-center text-xs text-muted-foreground space-x-3">
        <Link className="underline underline-offset-2" href="/datenschutz">Datenschutz</Link>
        <Link className="underline underline-offset-2" href="/hinweise">Hinweise</Link>
      </div>
    </div>
  )
}

export default function RegistrierenPage() {
  return (
    <Suspense>
      <RegistrierenForm />
    </Suspense>
  )
}