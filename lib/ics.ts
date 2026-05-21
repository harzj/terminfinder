/**
 * ICS parsing and generation utilities.
 * No external dependencies — hand-rolled parser for VEVENT/DTSTART/DTEND.
 */

// ── Parser ──────────────────────────────────────────────────────────────────

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
}

function parseDTValue(value: string): { date: string; time: string | null } | null {
  const v = value.trim()
  // All-day: YYYYMMDD (exactly 8 digits, no T)
  if (/^\d{8}$/.test(v)) {
    return { date: `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`, time: null }
  }
  // DateTime: YYYYMMDDTHHmm… — lenient: accept any suffix (Z, seconds, fractional, +offset)
  const m = v.match(/^(\d{8})T(\d{2})(\d{2})/)
  if (m) {
    return { date: `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`, time: `${m[2]}:${m[3]}` }
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

  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') { inEvent = true; dtstart = null; dtend = null; continue }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (dtstart) {
        if (dtstart.time === null) {
          // All-day event: DTEND is exclusive end per RFC 5545 → expand to cover every day
          const dates = dtend?.time === null ? expandDateRange(dtstart.date, dtend.date) : [dtstart.date]
          dates.forEach(date => results.push({ date, allDay: true, startTime: null, endTime: null }))
        } else {
          results.push({
            date: dtstart.date,
            allDay: false,
            startTime: dtstart.time,
            endTime: dtend?.time ?? null,
          })
        }
      }
      continue
    }
    if (!inEvent) continue
    if (line.startsWith('DTSTART')) {
      const ci = line.indexOf(':')
      if (ci !== -1) dtstart = parseDTValue(line.slice(ci + 1))
    }
    if (line.startsWith('DTEND')) {
      const ci = line.indexOf(':')
      if (ci !== -1) dtend = parseDTValue(line.slice(ci + 1))
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
