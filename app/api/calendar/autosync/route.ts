import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseICSEvents, BusyEvent } from '@/lib/ics'
import { getTimesForDate, DefaultTimes } from '@/lib/holidays'
import { addDays, format, parseISO } from 'date-fns'
import { decryptUrl } from '@/lib/encryption'
import { clampPlanningMonths, getPlanningRangeFromMonday, toLocalDateString } from '@/lib/planningWindow'

// ── Admin client (umgeht RLS für Cross-User-Batch) ─────────────────────────
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toMin(hhmm: string): number {
  const [h, m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** Stable fingerprint of ICS events for one day (sorted, so order doesn't matter). */
function computeIcsSignature(events: BusyEvent[]): string {
  if (events.length === 0) return ''
  return events
    .map(e => `${e.startTime ?? 'allday'}|${e.endTime ?? ''}|${e.summary}`)
    .sort()
    .join('~~')
}

type SyncAction = 'set_available' | 'set_uncertain' | 'set_busy' | 'no_change'

/**
 * Compute the auto-sync action for one day.
 * Rules (symmetric before + after the window):
 *  iii  – no events                       → available
 *  vi   – all-day / overlaps window       → busy
 *  v    – ends/starts within minDistance  → uncertain  (gap ≤ minDistance, gap=0 also uncertain)
 *  iv   – outside window by > minDistance → no impact  → available
 * Multiple events: most restrictive wins (busy > uncertain > available).
 */
function computeSyncAction(
  events: BusyEvent[],
  defStart: string,
  defEnd: string,
  minDistanceMinutes: number
): SyncAction {
  if (events.length === 0) return 'set_available'

  const defS = toMin(defStart)
  const defE = toMin(defEnd)

  let result: 'set_busy' | 'set_uncertain' | 'no_impact' = 'no_impact'

  for (const ev of events) {
    // All-day or missing times → full block
    if (ev.allDay || !ev.startTime || !ev.endTime) return 'set_busy'

    const evS = toMin(ev.startTime)
    const evE = toMin(ev.endTime)

    // Overlaps the window → busy
    if (evS < defE && evE > defS) return 'set_busy'

    if (evE <= defS) {
      // Event ends before window starts
      const gap = defS - evE   // minutes (>= 0, since evE == defS means gap 0)
      if (gap <= minDistanceMinutes) result = 'set_uncertain'
      // else: no impact (gap > minDistance)
    } else if (evS >= defE) {
      // Event starts after window ends
      const gap = evS - defE   // minutes
      if (gap <= minDistanceMinutes) {
        result = 'set_uncertain'
      }
      // else: no impact
    }
  }

  if (result === 'no_impact') return 'set_available'
  return result
}

// ── SSRF protection (same as calendar/import route) ────────────────────────
function isPrivateUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (
    host === 'localhost' || host === '0.0.0.0' ||
    /^127\./.test(host) || /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^::1$/.test(host) || /^fc00:/i.test(host) || /^fe80:/i.test(host)
  )
}

async function fetchICS(rawUrl: string): Promise<string | null> {
  const normalized = rawUrl.replace(/^webcal:\/\//i, 'https://')
  let parsed: URL
  try { parsed = new URL(normalized) } catch { return null }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null
  if (isPrivateUrl(parsed)) return null
  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Terminfinder-AutoSync/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text.includes('BEGIN:VCALENDAR')) return null
    return text
  } catch {
    return null
  }
}

// ── Core auto-sync for a single user ──────────────────────────────────────

async function runAutoSyncForUser(
  userId: string,
  autoSyncUrls: string[],
  minDistanceHours: number,
  planningMonths: number,
  defaultTimes: DefaultTimes | null,
  admin: ReturnType<typeof getAdminClient>
): Promise<{ changed: number; skipped: number }> {
  if (autoSyncUrls.length === 0) return { changed: 0, skipped: 0 }

  const minDistanceMinutes = minDistanceHours * 60

  // Fetch all enabled ICS calendars in parallel
  const icsTexts = await Promise.all(autoSyncUrls.map(fetchICS))

  // Parse and merge events by date
  const eventsByDate = new Map<string, BusyEvent[]>()
  for (const text of icsTexts) {
    if (!text) continue
    for (const ev of parseICSEvents(text)) {
      const list = eventsByDate.get(ev.date) ?? []
      list.push(ev)
      eventsByDate.set(ev.date, list)
    }
  }

  // Fensterlänge orientiert sich an der Profil-Einstellung (1-6 Monate).
  const { startDate: weekStart, totalDays } = getPlanningRangeFromMonday(planningMonths)
  const days = Array.from({ length: totalDays }, (_, i) => addDays(weekStart, i))

  // Load all existing sync states for this user in the window
  const startStr = toLocalDateString(weekStart)
  const endStr = format(days[days.length - 1], 'yyyy-MM-dd')

  const { data: existingStates } = await admin
    .from('calendar_sync_state')
    .select('date, ics_signature, last_action, last_sync_at, user_changed_at')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr)

  const stateByDate = new Map<string, {
    ics_signature: string
    last_action: string
    last_sync_at: string
    user_changed_at: string | null
  }>()
  for (const s of existingStates ?? []) {
    stateByDate.set(s.date, s)
  }

  // Load current availability for these dates
  const { data: currentAvailability } = await admin
    .from('availability')
    .select('date, status')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr)

  const availByDate = new Map<string, string>()
  for (const a of currentAvailability ?? []) {
    availByDate.set(a.date, a.status)
  }

  let changed = 0
  let skipped = 0

  const toUpsert: { user_id: string; date: string; status: string; from_time?: string | null; until_time?: string | null }[] = []
  const toDelete: string[] = []
  const stateUpserts: { user_id: string; date: string; ics_signature: string; last_action: string; last_sync_at: string }[] = []
  const logEntries: { user_id: string; date: string; action: string; ics_event_summary?: string; calendar_url?: string }[] = []

  const now = new Date().toISOString()

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const icsEvents = eventsByDate.get(dateStr) ?? []
    const currentSig = computeIcsSignature(icsEvents)
    const state = stateByDate.get(dateStr)

    // Same ICS state as last time we processed this day
    if (state && state.ics_signature === currentSig) {
      // If user changed AFTER the last sync with this signature → respect user choice
      if (state.user_changed_at && state.user_changed_at > state.last_sync_at) {
        skipped++
        continue
      }
      // Nothing changed → idempotent, skip
      skipped++
      continue
    }

    // ICS state changed (or first run for this day) → compute and apply action
    const defTimes = defaultTimes ? getTimesForDate(day, defaultTimes) : null

    let action: SyncAction
    if (!defTimes) {
      // No default times configured → only handle no-events case
      action = icsEvents.length === 0 ? 'set_available' : 'set_busy'
    } else {
      action = computeSyncAction(icsEvents, defTimes.start, defTimes.end, minDistanceMinutes)
    }

    const currentStatus = availByDate.get(dateStr) // undefined = busy

    // Check if action actually changes anything
    const isAlreadyAvailable = currentStatus === 'available'
    const isAlreadyUncertain = currentStatus === 'uncertain'
    const isAlreadyBusy = currentStatus === undefined

    let actuallyChanged = false
    if (action === 'set_available' && !isAlreadyAvailable) {
      toUpsert.push({
        user_id: userId,
        date: dateStr,
        status: 'available',
        from_time: defTimes?.start ?? null,
        until_time: defTimes?.end ?? null,
      })
      actuallyChanged = true
    } else if (action === 'set_uncertain' && !isAlreadyUncertain) {
      toUpsert.push({ user_id: userId, date: dateStr, status: 'uncertain', from_time: null, until_time: null })
      actuallyChanged = true
    } else if (action === 'set_busy' && !isAlreadyBusy) {
      toDelete.push(dateStr)
      actuallyChanged = true
    }
    // no_change or already in target state → update state tracking but don't log

    stateUpserts.push({
      user_id: userId,
      date: dateStr,
      ics_signature: currentSig,
      last_action: action,
      last_sync_at: now,
    })

    if (actuallyChanged) {
      changed++
      const firstEvent = icsEvents[0]
      logEntries.push({
        user_id: userId,
        date: dateStr,
        action,
        ics_event_summary: firstEvent?.summary,
      })
    }
  }

  // Write availability changes
  if (toUpsert.length > 0) {
    await admin.from('availability').upsert(toUpsert, { onConflict: 'user_id,date' })
  }
  if (toDelete.length > 0) {
    for (const date of toDelete) {
      await admin.from('availability').delete().eq('user_id', userId).eq('date', date)
    }
  }

  // Write state tracking
  if (stateUpserts.length > 0) {
    await admin.from('calendar_sync_state').upsert(stateUpserts, { onConflict: 'user_id,date' })
  }

  // Write log
  if (logEntries.length > 0) {
    await admin.from('calendar_sync_log').insert(
      logEntries.map(e => ({ ...e, synced_at: now }))
    )
  }

  return { changed, skipped }
}

// ── HTTP Handlers ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel Cron: protected with CRON_SECRET
  // Query-Parameter wird verwendet (überlebt HTTP-Redirects), Header als Fallback
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET missing' }, { status: 500 })
  }
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim()
  const headerSecret = req.headers.get('authorization')?.trim()?.replace(/^Bearer\s+/i, '')
  if (querySecret !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()

  // Load all users with auto_sync_enabled = true
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, auto_sync_urls, auto_sync_min_distance_hours, default_availability_times, availability_planning_months')
    .eq('auto_sync_enabled', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Record<string, { changed: number; skipped: number }> = {}

  for (const profile of profiles ?? []) {
    const urls = ((profile.auto_sync_urls as string[] | null) ?? []).map(u => decryptUrl(u as string)).filter(Boolean)
    const minDistance = profile.auto_sync_min_distance_hours ?? 3
    const planningMonths = clampPlanningMonths(profile.availability_planning_months)
    const defaultTimes = (profile.default_availability_times as DefaultTimes | null) ?? null

    results[profile.id] = await runAutoSyncForUser(
      profile.id,
      urls,
      minDistance,
      planningMonths,
      defaultTimes,
      admin
    )
  }

  // Cleanup: delete sync log entries older than 90 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  await admin.from('calendar_sync_log').delete().lt('synced_at', cutoff.toISOString())

  return NextResponse.json({ ok: true, results })
}

// ── POST: Sofort-Sync für den eingeloggten User ────────────────────────────

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('auto_sync_urls, auto_sync_min_distance_hours, default_availability_times, availability_planning_months')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const urls = ((profile.auto_sync_urls as string[] | null) ?? [])
    .map(u => decryptUrl(u as string))
    .filter(Boolean)

  const result = await runAutoSyncForUser(
    user.id,
    urls,
    profile.auto_sync_min_distance_hours ?? 3,
    profile.availability_planning_months ?? 1,
    (profile.default_availability_times as DefaultTimes | null) ?? null,
    admin
  )

  return NextResponse.json({ ok: true, ...result })
}
