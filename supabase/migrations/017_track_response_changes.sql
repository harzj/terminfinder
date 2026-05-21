-- Migration 017: Track response changes (previous_response)
-- Allows detecting when a participant changed away from 'accepted'
ALTER TABLE public.event_responses
  ADD COLUMN IF NOT EXISTS previous_response text;
