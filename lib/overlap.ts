import { Database } from './supabase/database.types'

type AvailabilityRow = Database['public']['Tables']['availability']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface ParticipantInfo {
  id: string
  display_name: string
}

export interface OverlapResult {
  date: string
  from_time: string
  until_time: string
  confirmed_participants: ParticipantInfo[]
  uncertain_participants: ParticipantInfo[]
}

const DEFAULT_FROM = '15:00'
const DEFAULT_UNTIL = '24:00'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function computeOverlaps(
  availabilities: (AvailabilityRow & { profiles: ProfileRow })[],
  profiles: ProfileRow[],
  minParticipants: number,
  startDate: Date,
  endDate: Date
): OverlapResult[] {
  const results: OverlapResult[] = []

  // Gruppiere Verfügbarkeiten nach Datum
  const byDate = new Map<string, (AvailabilityRow & { profiles: ProfileRow })[]>()
  for (const a of availabilities) {
    const existing = byDate.get(a.date) ?? []
    existing.push(a)
    byDate.set(a.date, existing)
  }

  // Iteriere über alle Tage im Bereich
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const dayAvailabilities = byDate.get(dateStr) ?? []

    const confirmed = dayAvailabilities.filter((a) => a.status === 'available')
    const uncertain = dayAvailabilities.filter((a) => a.status === 'uncertain')

    // Genug sichere Zusagen → Zeitfenster nur aus "Kann"-Personen
    if (confirmed.length >= minParticipants) {
      const froms = confirmed.map((a) => timeToMinutes(a.from_time ?? DEFAULT_FROM))
      const untils = confirmed.map((a) => timeToMinutes(a.until_time ?? DEFAULT_UNTIL))

      const overlapFrom = Math.max(...froms)
      const overlapUntil = Math.min(...untils)

      if (overlapUntil > overlapFrom) {
        results.push({
          date: dateStr,
          from_time: minutesToTime(overlapFrom),
          until_time: minutesToTime(overlapUntil),
          confirmed_participants: confirmed.map((a) => ({
            id: a.user_id,
            display_name: a.profiles.display_name,
          })),
          uncertain_participants: uncertain.map((a) => ({
            id: a.user_id,
            display_name: a.profiles.display_name,
          })),
        })
      }
    // Nicht genug sichere, aber Kann + Unklar reicht → Zeitfenster aus allen
    } else if (confirmed.length + uncertain.length >= minParticipants) {
      const all = [...confirmed, ...uncertain]
      const froms = all.map((a) => timeToMinutes(a.from_time ?? DEFAULT_FROM))
      const untils = all.map((a) => timeToMinutes(a.until_time ?? DEFAULT_UNTIL))

      const overlapFrom = Math.max(...froms)
      const overlapUntil = Math.min(...untils)

      if (overlapUntil > overlapFrom) {
        results.push({
          date: dateStr,
          from_time: minutesToTime(overlapFrom),
          until_time: minutesToTime(overlapUntil),
          confirmed_participants: confirmed.map((a) => ({
            id: a.user_id,
            display_name: a.profiles.display_name,
          })),
          uncertain_participants: uncertain.map((a) => ({
            id: a.user_id,
            display_name: a.profiles.display_name,
          })),
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return results
}
