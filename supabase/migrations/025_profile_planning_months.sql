-- Migration 025: Individueller Planungshorizont für Verfügbarkeit
-- 1 = aktuelle Woche + 4 Wochen (Standard), max. 6 Monate.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_planning_months integer NOT NULL DEFAULT 1;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_availability_planning_months_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_availability_planning_months_check
  CHECK (availability_planning_months >= 1 AND availability_planning_months <= 6);
