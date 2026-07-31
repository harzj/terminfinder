const MIN_PLANNING_MONTHS = 1
const MAX_PLANNING_MONTHS = 6

/** Begrenzung auf den erlaubten Einstellungsbereich (1-6 Monate). */
export function clampPlanningMonths(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return MIN_PLANNING_MONTHS
  return Math.min(MAX_PLANNING_MONTHS, Math.max(MIN_PLANNING_MONTHS, Math.trunc(numeric)))
}

/** Aktuelle Woche plus 4 Wochen je eingestelltem Monat. */
export function getPlanningWeeks(planningMonths: number): number {
  return 1 + 4 * clampPlanningMonths(planningMonths)
}

/** Anzahl der Kalendertage im Planungsfenster. */
export function getPlanningDays(planningMonths: number): number {
  return getPlanningWeeks(planningMonths) * 7
}

/** Montag der aktuellen Woche in lokaler Zeitzone. */
export function getCurrentWeekMonday(baseDate: Date = new Date()): Date {
  const day = new Date(baseDate)
  day.setHours(0, 0, 0, 0)
  const dayOfWeek = day.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  day.setDate(day.getDate() + daysToMonday)
  return day
}

/** Format yyyy-MM-dd ohne UTC-Shift über toISOString(). */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Start/Ende des Planungsfensters ab aktuellem Wochen-Montag. */
export function getPlanningRangeFromMonday(planningMonths: number, baseDate: Date = new Date()): {
  startDate: Date
  endDate: Date
  totalDays: number
} {
  const startDate = getCurrentWeekMonday(baseDate)
  const totalDays = getPlanningDays(planningMonths)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + totalDays - 1)
  return { startDate, endDate, totalDays }
}
