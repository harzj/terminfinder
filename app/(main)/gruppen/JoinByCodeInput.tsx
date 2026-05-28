'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hash } from 'lucide-react'

export default function JoinByCodeInput() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupId, error: rpcError } = await (supabase as any).rpc('join_group_by_code', {
      p_code: code.trim().toUpperCase(),
    })
    setLoading(false)
    if (rpcError) {
      setError('Ungültiger Code. Bitte prüfe die Eingabe.')
      return
    }
    router.push(`/gruppen/${groupId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleJoin} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              setError(null)
            }}
            placeholder="XXXXXX"
            className="pl-9 font-mono tracking-widest uppercase"
            maxLength={6}
          />
        </div>
        <Button type="submit" disabled={loading || code.length !== 6} variant="outline">
          {loading ? '…' : 'Beitreten'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
