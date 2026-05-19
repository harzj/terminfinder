-- Cache BGG collection in user profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bgg_collection JSONB DEFAULT '[]'::jsonb;
