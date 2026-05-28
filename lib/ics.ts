/**
 * ICS parsing and generation utilities.
 * No external dependencies — hand-rolled parser for VEVENT/DTSTART/DTEND.
 *
 * All times are normalised to Europe/Berlin so that comparisons against the
 * user's availability window (also stored in Berlin local time) are correct.
 */

// ── Timezone helpers ────────────────────────────────────────────────────────

const BERLIN_TZ = 'Europe/Berlin'

/** Convert a UTC Date to { date, time } in Europe/Berlin. */
function toDateTimeInBerlin(d: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en', {
    timeZone: BERLIN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => f.find(p => p.type === t)?.value ?? '00'
  const h = g('hour')
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    time: `${h === '24' ? '00' : h}:${g('minute')}`,
  }
}

/**
 * Interpret a floating datetime (e.g. "2026-05-29T15:00") as being in `tz`,
 * and return the corresponding UTC Date.
 * Uses the standard "pseudoUTC + offset correction" trick since the Temporal
 * API is not yet available in all runtimes.
 */
function parseTZDatetime(rawDate: string, hh: string, mm: string, tz: string): Date {
  const pseudoUtc = new Date(`${rawDate}T${hh}:${mm}:00Z`)
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(pseudoUtc)
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0')
  const h = g('hour') === 24 ? 0 : g('hour')
  const inTzAsUtc = new Date(Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute')))
  const offsetMs = pseudoUtc.getTime() - inTzAsUtc.getTime()
  return new Date(pseudoUtc.getTime() + offsetMs)
}

/**
 * Extracts all "busy" dates (yyyy-MM-dd) from an ICS string.
 * Handles: date-only, datetime-local, datetime-UTC, TZID variants.
 * RRULE (recurring events) are NOT expanded — only DTSTART is used.
 */
export function parseICS(text: string): string[] {
  return parseICSEvents(text).map(e => e.date)
}

/** A busy event parsed from an ICS VEVENT block. */
export interface BusyEvent {
  date: string          // yyyy-MM-dd (from DTSTART)
  allDay: boolean
  startTime: string | null  // HH:MM
  endTime: string | null    // HH:MM
  summary: string
}

function parseEventLine(line: string): { name: string; value: string; tzid?: string } | null {
  const ci = line.indexOf(':')
  if (ci === -1) return null
  const rawName = line.slice(0, ci).trim()
  const value = line.slice(ci + 1).trim()
  if (!rawName) return null
  const parts = rawName.split(';')
  const name = parts[0].toUpperCase()
  const tzidPart = parts.slice(1).find(p => p.toUpperCase().startsWith('TZID='))
  const tzid = tzidPart ? tzidPart.slice(5) : undefined
  return { name, value, tzid }
}

function unescapeICSText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseDTValue(value: string, tzid?: string): { date: string; time: string | null } | null {
  const v = value.trim()
  // All-day: YYYYMMDD (exactly 8 digits, no T)
  if (/^\d{8}$/.test(v)) {
    return { date: `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`, time: null }
  }
  // DateTime: YYYYMMDDTHHmm… — lenient: accept any suffix (Z, seconds, fractional, +offset)
  const m = v.match(/^(\d{8})T(\d{2})(\d{2})/)
  if (m) {
    const rawDate = `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`
    const hh = m[2]
    const mm = m[3]
    const isUtc = v.includes('Z')

    if (isUtc) {
      // UTC timestamp → convert to Europe/Berlin
      return toDateTimeInBerlin(new Date(`${rawDate}T${hh}:${mm}:00Z`))
    }

    if (tzid) {
      const normalTz = tzid.trim()
      // Berlin-equivalent TZIDs — no conversion needed
      const isBerlin = /^Europe\/Berlin$/i.test(normalTz) ||
        /^CET$/i.test(normalTz) || /^CEST$/i.test(normalTz) ||
        /^W\. Europe Standard Time$/i.test(normalTz)
      if (!isBerlin) {
        try {
          return toDateTimeInBerlin(parseTZDatetime(rawDate, hh, mm, normalTz))
        } catch {
          // Unknown TZID — fall through and treat as Berlin floating time
        }
      }
    }

    // Floating time (no Z, no TZID) or Berlin TZID → already in Berlin local time
    return { date: rawDate, time: `${hh}:${mm}` }
  }
  return null
}

/**
 * Expand a range [start, end) of yyyy-MM-dd dates, one entry per day.
 * Used for all-day events where DTEND is the exclusive end per RFC 5545.
 * Uses local date arithmetic (noon anchor) to avoid UTC-offset day shifts.
 */
function expandDateRange(start: string, end: string): string[] {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dates: string[] = []
  // Anchor at noon to survive DST transitions without crossing a date boundary
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d < endD) {
    dates.push(fmt(d))
    d.setDate(d.getDate() + 1)
  }
  return dates.length > 0 ? dates : [start]
}

/** Extracts all busy events with optional start/end times from an ICS string. */
export function parseICSEvents(text: string): BusyEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)
  const results: BusyEvent[] = []
  let inEvent = false
  let dtstart: { date: string; time: string | null } | null = null
  let dtend: { date: string; time: string | null } | null = null
  let summary: string | null = null
  let transparency: string | null = null
  let busyStatus: string | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      dtstart = null
      dtend = null
      summary = null
      transparency = null
      busyStatus = null
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      const isFreeByTransparency = (transparency ?? '').toUpperCase() === 'TRANSPARENT'
      const isFreeByBusyStatus = (busyStatus ?? '').toUpperCase() === 'FREE'
      const isFreeEvent = isFreeByTransparency || isFreeByBusyStatus
      if (dtstart && !isFreeEvent) {
        const safeSummary = (summary?.trim() || '(ohne Titel)')
        if (dtstart.time === null) {
          // All-day event: DTEND is exclusive end per RFC 5545 → expand to cover every day
          const dates = dtend?.time === null ? expandDateRange(dtstart.date, dtend.date) : [dtstart.date]
          dates.forEach(date => results.push({ date, allDay: true, startTime: null, endTime: null, summary: safeSummary }))
        } else {
          results.push({
            date: dtstart.date,
            allDay: false,
            startTime: dtstart.time,
            endTime: dtend?.time ?? null,
            summary: safeSummary,
          })
        }
      }
      continue
    }
    if (!inEvent) continue
    const parsed = parseEventLine(line)
    if (!parsed) continue
    if (parsed.name === 'DTSTART') {
      dtstart = parseDTValue(parsed.value, parsed.tzid)
      continue
    }
    if (parsed.name === 'DTEND') {
      dtend = parseDTValue(parsed.value, parsed.tzid)
      continue
    }
    if (parsed.name === 'SUMMARY') {
      summary = unescapeICSText(parsed.value)
      continue
    }
    if (parsed.name === 'TRANSP') {
      transparency = parsed.value
      continue
    }
    if (parsed.name === 'X-MICROSOFT-CDO-BUSYSTATUS') {
      busyStatus = parsed.value
      continue
    }
  }
  return results
}

// ── Generator ─────────────────────────────────────────────────────────────

export interface ICSEvent {
  uid: string
  date: string        // yyyy-MM-dd
  fromTime?: string | null   // HH:MM
  untilTime?: string | null  // HH:MM
  summary: string
  description?: string
}

export function generateICS(events: ICSEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Terminfinder//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Terminfinder',
  ]

  for (const ev of events) {
    const dateCompact = ev.date.replace(/-/g, '')   // 20260521

    let dtstart: string
    let dtend: string

    if (ev.fromTime) {
      const fromCompact = ev.fromTime.replace(':', '') + '00'  // 183000
      dtstart = `${dateCompact}T${fromCompact}`

      if (ev.untilTime) {
        const untilCompact = ev.untilTime.replace(':', '') + '00'
        dtend = `${dateCompact}T${untilCompact}`
      } else {
        // Default: 2 hours after start
        dtend = dtstart
      }
    } else {
      // All-day event
      dtstart = dateCompact
      // DTEND for all-day = next day
      const next = new Date(ev.date)
      next.setDate(next.getDate() + 1)
      dtend = next.toISOString().slice(0, 10).replace(/-/g, '')
    }

    const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

    if (ev.fromTime) {
      lines.push(`BEGIN:VEVENT`)
      lines.push(`UID:${ev.uid}@terminfinder`)
      lines.push(`DTSTART:${dtstart}`)
      lines.push(`DTEND:${dtend}`)
      lines.push(`SUMMARY:${escaped(ev.summary)}`)
      if (ev.description) lines.push(`DESCRIPTION:${escaped(ev.description)}`)
      lines.push(`END:VEVENT`)
    } else {
      lines.push(`BEGIN:VEVENT`)
      lines.push(`UID:${ev.uid}@terminfinder`)
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
      lines.push(`DTEND;VALUE=DATE:${dtend}`)
      lines.push(`SUMMARY:${escaped(ev.summary)}`)
      if (ev.description) lines.push(`DESCRIPTION:${escaped(ev.description)}`)
      lines.push(`END:VEVENT`)
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
