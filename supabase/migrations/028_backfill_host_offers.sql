-- Migration 028: Bestehende Zusagen für Host-Funktion nachziehen

-- Für bereits existierende Events sollen bestätigte Zusagen direkt als
-- Gastgeber-Angebot gelten, damit der Initiator sofort einen Host wählen kann.
UPDATE public.event_responses
SET host_offer = true
WHERE response = 'accepted'
  AND host_offer = false;
