-- Migration 024: Event-Antworten für neue Mitglieder vorausfüllen
--
-- Problem: prefill_event_responses() läuft nur beim INSERT eines neuen Events.
-- Tritt jemand einer bestehenden Gruppe bei (via Link, Code oder E-Mail-Invite),
-- fehlen ihm die event_responses-Zeilen für laufende/bestätigte Events → er
-- taucht nicht in der Abstimmungsliste auf und kann nicht abstimmen.
--
-- Fix: Trigger auf group_members, der bei Statuswechsel auf 'active' (oder
-- Neuanlage mit 'active') für alle voting/confirmed Events der Gruppe
-- eine 'uncertain'-Antwort anlegt.

CREATE OR REPLACE FUNCTION public.prefill_responses_for_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nur auslösen wenn Status jetzt 'active' ist und user_id bekannt
  IF NEW.status != 'active' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Bei UPDATE: nur wenn vorher nicht bereits aktiv (idempotent)
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- event_responses für alle laufenden und bestätigten Events anlegen
  INSERT INTO public.event_responses (event_id, user_id, response)
  SELECT e.id, NEW.user_id, 'uncertain'
  FROM public.events e
  WHERE e.group_id = NEW.group_id
    AND e.status IN ('voting', 'confirmed')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_joined
  AFTER INSERT OR UPDATE ON public.group_members
  FOR EACH ROW EXECUTE PROCEDURE public.prefill_responses_for_new_member();
