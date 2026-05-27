import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptUrl } from '@/lib/encryption'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    calendar_import_url?: string | null
    auto_sync_urls?: string[]
    auto_sync_enabled?: boolean
    auto_sync_min_distance_hours?: number
  }

  const update: {
    calendar_import_url?: string | null
    auto_sync_urls?: string[]
    auto_sync_enabled?: boolean
    auto_sync_min_distance_hours?: number
  } = {}

  if ('calendar_import_url' in body) {
    update.calendar_import_url = body.calendar_import_url
      ? encryptUrl(body.calendar_import_url)
      : null
  }
  if ('auto_sync_urls' in body && Array.isArray(body.auto_sync_urls)) {
    update.auto_sync_urls = body.auto_sync_urls.map(encryptUrl)
  }
  if ('auto_sync_enabled' in body) {
    update.auto_sync_enabled = body.auto_sync_enabled
  }
  if ('auto_sync_min_distance_hours' in body) {
    update.auto_sync_min_distance_hours = body.auto_sync_min_distance_hours
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
