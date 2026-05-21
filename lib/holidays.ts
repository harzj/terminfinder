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

/** Returns true if the date is a Saturday, Sunday, or public holiday */
export function isFreiDay(date: Date): boolean {
  const year = date.getFullYear()
  const holidays = new Set([
    ...getGermanHolidays(year),
    ...getGermanHolidays(year + 1),
  ])
  const dow = date.getDay()
  return dow === 0 || dow === 6 || holidays.has(format(date, 'yyyy-MM-dd'))
}

/**
 * 4-field availability defaults:
 * - start_frei:          Start-Zeit für freie Tage (Sa, So, Feiertage)
 * - start_werktag:       Start-Zeit für Werktage (Mo–Fr)
 * - ende_next_workday:   Ende-Zeit wenn nächster Tag ein Werktag ist (Mo–Do, So)
 * - ende_next_free:      Ende-Zeit wenn nächster Tag frei ist (Fr, Sa, Tag vor Feiertag)
 */
export interface DefaultTimes {
  start_frei: string
  start_werktag: string
  ende_next_workday: string
  ende_next_free: string
}

/** Derive start/end times for a given date from the 4-field DefaultTimes */
export function getTimesForDate(date: Date, times: DefaultTimes): { start: string; end: string } {
  const frei = isFreiDay(date)
  const nextFrei = isFreiDay(addDays(date, 1))
  return {
    start: frei ? times.start_frei : times.start_werktag,
    end: nextFrei ? times.ende_next_free : times.ende_next_workday,
  }
}
