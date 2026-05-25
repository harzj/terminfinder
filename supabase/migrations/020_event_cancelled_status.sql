-- Erlaube 'cancelled' als neuen Status für Events
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname = 'events'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE events DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('voting', 'confirmed', 'expired', 'cancelled'));

-- Zeitpunkt der Absage (optional, für Audit-Trail)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
