-- ============================================================
-- Migration 012: bgg_id in event_games optional machen
-- Ermöglicht manuelles Eintragen von Spielen ohne BGG-Verknüpfung
-- ============================================================

alter table public.event_games
  alter column bgg_id drop not null;
