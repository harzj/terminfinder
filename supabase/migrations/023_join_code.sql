-- Migration 023: 6-stelliger Beitrittscode für Gruppen

-- ── 1. Spalte join_code in groups ─────────────────────────────────────────
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- ── 2. Helper: zufälligen Code generieren (ohne 0/O/1/I) ──────────────────
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  rand_bytes BYTEA;
BEGIN
  rand_bytes := gen_random_bytes(6);
  FOR i IN 0..5 LOOP
    result := result || substr(chars, (get_byte(rand_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ── 3. Bestehende Gruppen mit Code befüllen ────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  new_code TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.groups WHERE join_code IS NULL LOOP
    LOOP
      new_code := public.generate_join_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE join_code = new_code);
    END LOOP;
    UPDATE public.groups SET join_code = new_code WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ── 4. NOT NULL setzen ─────────────────────────────────────────────────────
ALTER TABLE public.groups
  ALTER COLUMN join_code SET NOT NULL,
  ALTER COLUMN join_code SET DEFAULT public.generate_join_code();

-- ── 5. RPC: Gruppe per Code beitreten ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid      UUID;
  v_email    TEXT;
  v_group_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT id INTO v_group_id
  FROM public.groups
  WHERE join_code = upper(trim(p_code));

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Ungültiger Code';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, email, status, joined_at)
  VALUES (v_group_id, v_uid, coalesce(v_email, v_uid::text), 'active', now())
  ON CONFLICT (group_id, email) DO UPDATE
    SET user_id = v_uid, status = 'active', joined_at = now();

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_by_code(TEXT) TO authenticated;

-- ── 6. RPC: Code erneuern (nur Ersteller) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.regenerate_join_code(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.groups WHERE id = p_group_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  LOOP
    v_new_code := public.generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE join_code = v_new_code);
  END LOOP;

  UPDATE public.groups SET join_code = v_new_code WHERE id = p_group_id;
  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_join_code(UUID) TO authenticated;
