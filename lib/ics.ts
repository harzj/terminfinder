/**
 * ICS parsing and generation utilities.
 * No external dependencies — hand-rolled parser for VEVENT/DTSTART.
 */

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Extracts all "busy" dates (yyyy-MM-dd) from an ICS string.
 * Handles: date-only, datetime-local, datetime-UTC, TZID variants.
 * RRULE (recurring events) are NOT expanded — only DTSTART is used.
 */
export function parseICS(text: string): string[] {
  const dates = new Set<string>()

  // Unfold long lines (RFC 5545: continuation lines start with space or tab)
  const unfolded = text.replace(/\r?\n[ \t]/g, '')

  const lines = unfolded.split(/\r?\n/)

  let inEvent = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') { inEvent = true; continue }
    if (line === 'END:VEVENT') { inEvent = false; continue }
    if (!inEvent) continue

    // Match DTSTART lines: DTSTART, DTSTART;VALUE=DATE, DTSTART;TZID=...
    if (line.startsWith('DTSTART')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const value = line.slice(colonIdx + 1).trim()
      // Extract just the date portion (first 8 chars = YYYYMMDD)
      const raw8 = value.replace('T', '').slice(0, 8)
      if (/^\d{8}$/.test(raw8)) {
        const yyyy = raw8.slice(0, 4)
        const mm   = raw8.slice(4, 6)
        const dd   = raw8.slice(6, 8)
        dates.add(`${yyyy}-${mm}-${dd}`)
      }
    }
  }

  return Array.from(dates)
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
