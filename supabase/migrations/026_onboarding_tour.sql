-- Migration 026: Onboarding-Tour pro User
-- null = Tour noch nicht gesehen / beim nächsten Login anzeigen.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_tour_seen_at timestamptz DEFAULT NULL;
