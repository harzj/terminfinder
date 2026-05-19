import { format, addDays } from 'date-fns'

/** Compute Easter Sunday for a given year (Gaussian algorithm) */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Returns a Set of 'yyyy-MM-dd' strings for German national public holidays (all states) */
export function getGermanHolidays(year: number): Set<string> {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')
  const easter = easterSunday(year)
  return new Set([
    `${year}-01-01`,              // Neujahr
    fmt(addDays(easter, -2)),     // Karfreitag
    fmt(addDays(easter, 1)),      // Ostermontag
    `${year}-05-01`,              // Tag der Arbeit
    fmt(addDays(easter, 39)),     // Christi Himmelfahrt
    fmt(addDays(easter, 50)),     // Pfingstmontag
    `${year}-10-03`,              // Tag der Deutschen Einheit
    `${year}-12-25`,              // 1. Weihnachtstag
    `${year}-12-26`,              // 2. Weihnachtstag
  ])
}

export type DayType = 'workday' | 'pre_free' | 'free_day'

/**
 * Classify a date into a day type for default availability times.
 *
 * - free_day:  Saturday, Sunday, or public holiday
 * - pre_free:  Day whose next day is a free_day (typically Friday or day before holiday)
 * - workday:   Everything else (Mon–Thu, not before a holiday)
 */
export function getDayType(date: Date): DayType {
  const year = date.getFullYear()
  // Cover year boundaries
  const holidays = new Set([
    ...getGermanHolidays(year),
    ...getGermanHolidays(year + 1),
  ])

  const dateStr = format(date, 'yyyy-MM-dd')
  const dow = date.getDay() // 0=Sun, 6=Sat

  if (dow === 0 || dow === 6 || holidays.has(dateStr)) return 'free_day'

  const tomorrow = addDays(date, 1)
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')
  const tomorrowDow = tomorrow.getDay()
  if (tomorrowDow === 0 || tomorrowDow === 6 || holidays.has(tomorrowStr)) return 'pre_free'

  return 'workday'
}

export interface DefaultTimes {
  workday?: { start: string; end: string }
  pre_free?: { start: string; end: string }
  free_day?: { start: string; end: string }
}
