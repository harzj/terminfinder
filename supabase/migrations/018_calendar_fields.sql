-- Migration 018: Add calendar_token and calendar_import_url to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS calendar_import_url text;

-- Backfill any rows that somehow have a null token (shouldn't happen with DEFAULT, but safe)
UPDATE public.profiles SET calendar_token = gen_random_uuid() WHERE calendar_token IS NULL;
