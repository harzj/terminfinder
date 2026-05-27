'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { RotateCcw, ChevronDown, X } from 'lucide-react'

const SEEN_KEY = 'tf_autosync_seen_at'

interface LogEntry {
  id: string
  date: string
  action: string
  ics_event_summary: string | null
  synced_at: string
}

const ACTION_LABEL: Record<string, string> = {
  set_available: 'auf verfügbar gesetzt',
  set_uncertain: 'auf unklar gesetzt',
  set_busy: 'auf nicht verfügbar gesetzt',
}

export default function AutoSyncBanner() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const seenAt = localStorage.getItem(SEEN_KEY) ?? new Date(0).toISOString()

    supabase
      .from('calendar_sync_log')
      .select('id, date, action, ics_event_summary, synced_at')
      .gt('synced_at', seenAt)
      .order('synced_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEntries(data)
          setVisible(true)
        }
      })
  }, [])

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-3">
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="flex-1 text-amber-800 dark:text-amber-200 font-medium">
            Auto-Sync hat {entries.length} {entries.length === 1 ? 'Änderung' : 'Änderungen'} vorgenommen
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-amber-600 hover:text-amber-800 p-0.5"
            aria-label="Details anzeigen"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-amber-600 hover:text-amber-800 p-0.5"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900/50 max-h-64 overflow-y-auto">
            {entries.map((e) => {
              const dateLabel = format(parseISO(e.date), 'EEE, d. MMM', { locale: de })
              const actionLabel = ACTION_LABEL[e.action] ?? e.action
              return (
                <div key={e.id} className="px-3 py-2 flex items-start gap-2">
                  <span className="text-amber-700 dark:text-amber-300 font-medium w-28 shrink-0">{dateLabel}</span>
                  <span className="text-amber-800 dark:text-amber-200 text-xs">
                    {actionLabel}
                    {e.ics_event_summary && (
                      <span className="text-amber-600 dark:text-amber-400"> · {e.ics_event_summary}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
