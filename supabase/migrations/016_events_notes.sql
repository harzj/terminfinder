-- Migration 016: Add notes column to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
