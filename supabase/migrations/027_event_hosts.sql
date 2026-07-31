-- Migration 027: Gastgeber-Angebot und finalen Gastgeber pro Event speichern

-- Final ausgewählten Gastgeber direkt am Event speichern.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Pro Antwort speichern, ob sich die Person als Gastgeber anbietet.
ALTER TABLE public.event_responses
  ADD COLUMN IF NOT EXISTS host_offer boolean NOT NULL DEFAULT false;

-- Konsistenz: Gastgeber-Angebot ist nur bei "accepted" erlaubt.
ALTER TABLE public.event_responses
  DROP CONSTRAINT IF EXISTS event_responses_host_offer_requires_accepted;

ALTER TABLE public.event_responses
  ADD CONSTRAINT event_responses_host_offer_requires_accepted
  CHECK (host_offer = false OR response = 'accepted');
