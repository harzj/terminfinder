-- Migration 021: Auto-Sync Kalender (Beta)

-- ── 1. Neue Spalten in profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sync_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_sync_min_distance_hours integer NOT NULL DEFAULT 3;

-- ── 2. Tabelle: calendar_sync_state ────────────────────────────────────────
-- Speichert pro User + Tag den letzten Auto-Sync-Zustand.
-- Wird verwendet, um zu entscheiden ob ein Tag erneut synchronisiert wird.
CREATE TABLE IF NOT EXISTS public.calendar_sync_state (
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  ics_signature   text        NOT NULL DEFAULT '',
  last_action     text        NOT NULL DEFAULT 'no_change',
  last_sync_at    timestamptz NOT NULL DEFAULT now(),
  user_changed_at timestamptz,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sync state"
  ON public.calendar_sync_state
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 3. Tabelle: calendar_sync_log ──────────────────────────────────────────
-- Audit-Log für die Dashboard-Info-Box: was hat der letzte Sync geändert?
CREATE TABLE IF NOT EXISTS public.calendar_sync_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                date        NOT NULL,
  action              text        NOT NULL,   -- 'set_available' | 'set_uncertain' | 'set_busy'
  ics_event_summary   text,
  calendar_url        text,
  synced_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- Nutzer können nur eigene Log-Einträge lesen; Schreiben nur via service role
CREATE POLICY "Users read own sync log"
  ON public.calendar_sync_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Index für schnelle Abfragen nach User + Zeit (für Info-Box)
CREATE INDEX IF NOT EXISTS calendar_sync_log_user_synced
  ON public.calendar_sync_log (user_id, synced_at DESC);
