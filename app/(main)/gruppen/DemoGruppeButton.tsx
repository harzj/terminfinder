'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export default function DemoGruppeButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: groupId, error: rpcError } = await supabase.rpc('create_demo_group')
    if (groupId) {
      router.push(`/gruppen/${groupId}`)
    } else {
      setError(rpcError?.message ?? 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="outline" onClick={handleCreate} disabled={loading}>
        <Sparkles className="h-4 w-4 mr-2" />
        {loading ? 'Erstelle Demo…' : 'Demo Gruppe erstellen'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
