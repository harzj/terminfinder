import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { generateICS, ICSEvent } from '@/lib/ics'
import type { Database } from '@/lib/supabase/database.types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Validate token format (uuid)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(token)) {
    return new Response('Not found', { status: 404 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = serviceRoleKey
    ? createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )
    : await createClient()

  // Look up user by token
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('calendar_token', token)
    .maybeSingle()

  if (!profile) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch all future confirmed events for groups this user belongs to
  const today = new Date().toISOString().split('T')[0]

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', profile.id)
    .eq('status', 'active')

  const groupIds = (memberships ?? []).map((m: any) => m.group_id as string)

  if (groupIds.length === 0) {
    const ics = generateICS([])
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="terminfinder.ics"',
        'Cache-Control': 'no-cache, no-store',
      },
    })
  }

  // Nur Events laden, bei denen der Nutzer selbst zugesagt hat
  const { data: acceptedResponses } = await supabase
    .from('event_responses')
    .select('event_id')
    .eq('user_id', profile.id)
    .eq('response', 'accepted')

  const acceptedEventIds = (acceptedResponses ?? []).map((r: any) => r.event_id as string)

  if (acceptedEventIds.length === 0) {
    const ics = generateICS([])
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="terminfinder.ics"',
        'Cache-Control': 'no-cache, no-store',
      },
    })
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, proposed_date, from_time, until_time, notes, groups(name)')
    .in('group_id', groupIds)
    .eq('status', 'confirmed')
    .in('id', acceptedEventIds)
    .gte('proposed_date', today)
    .order('proposed_date')

  const icsEvents: ICSEvent[] = (events ?? []).map((ev: any) => ({
    uid: ev.id,
    date: ev.proposed_date,
    fromTime: ev.from_time ? ev.from_time.slice(0, 5) : null,
    untilTime: ev.until_time ? ev.until_time.slice(0, 5) : null,
    summary: `Spieleabend – ${ev.groups?.name ?? 'Gruppe'}`,
    description: ev.notes ?? undefined,
  }))

  const ics = generateICS(icsEvents)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="terminfinder.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
