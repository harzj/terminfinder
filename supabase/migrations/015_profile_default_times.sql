-- Migration 015: Default availability times per day type
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_availability_times JSONB DEFAULT NULL;
