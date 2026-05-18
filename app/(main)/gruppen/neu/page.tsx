'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NeueGruppePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minParticipants, setMinParticipants] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/anmelden'); return }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: name.trim(), description: description.trim() || null, min_participants: minParticipants, created_by: user.id })
      .select()
      .single()

    if (groupError || !group) {
      setError(`Gruppe konnte nicht erstellt werden: ${groupError?.message ?? 'Unbekannter Fehler'} (Code: ${groupError?.code ?? '-'})`)
      setLoading(false)
      return
    }

    // Ersteller als aktives Mitglied eintragen (Fallback falls Trigger nicht greift)
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      email: user.email!,
      status: 'active',
      invited_by: user.id,
      joined_at: new Date().toISOString(),
    })
    if (memberError && memberError.code !== '23505') {
      // 23505 = unique violation = Trigger hat bereits eingefügt, kein echtes Problem
      setError(`Mitglied konnte nicht eingetragen werden: ${memberError.message} (Code: ${memberError.code})`)
      setLoading(false)
      return
    }

    router.push(`/gruppen/${group.id}`)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/gruppen" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Neue Gruppe</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Gruppenname *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Brettspielrunde Freitagsgruppe"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="z.B. Jeden Freitag bei Max"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min">Mindest-Teilnehmer</Label>
              <Input
                id="min"
                type="number"
                min={2}
                max={20}
                value={minParticipants}
                onChange={(e) => setMinParticipants(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Ab wie vielen Personen gilt ein Termin als möglich?
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Erstellen…' : 'Gruppe erstellen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
