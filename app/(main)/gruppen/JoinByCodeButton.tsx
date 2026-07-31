'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Hash } from 'lucide-react'

export default function JoinByCodeButton({ buttonId }: { buttonId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openDialog = () => {
    setCode('')
    setError(null)
    setOpen(true)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    setError(null)
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupId, error: rpcError } = await (supabase as any).rpc('join_group_by_code', {
      p_code: code,
    })
    setLoading(false)
    if (rpcError) {
      setError('Ungültiger Code. Bitte prüfe die Eingabe.')
      return
    }
    setOpen(false)
    router.push(`/gruppen/${groupId}`)
    router.refresh()
  }

  return (
    <>
      <Button id={buttonId} size="sm" variant="outline" onClick={openDialog}>
        <Hash className="h-4 w-4 mr-1" /> Code
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Per Code beitreten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="join-code">6-stelliger Beitrittscode</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                  setError(null)
                }}
                placeholder="XXXXXX"
                className="font-mono tracking-[0.3em] text-center text-xl"
                maxLength={6}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading || code.length !== 6}>
                {loading ? '…' : 'Beitreten'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
