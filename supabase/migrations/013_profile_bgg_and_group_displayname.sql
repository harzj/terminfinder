-- Add BGG username to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bgg_username TEXT;

-- Add per-group display name override to group members
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS display_name TEXT;
