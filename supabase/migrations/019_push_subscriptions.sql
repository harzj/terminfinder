-- Push-Subscriptions: Speichert Web-Push-Endpoints pro Benutzer
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benutzer verwalten eigene Push-Subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Push-Notifications-Sent: Verhindert Doppelbenachrichtigungen pro Event und Typ
CREATE TABLE IF NOT EXISTS push_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  UNIQUE(event_id, notification_type)
);

ALTER TABLE push_notifications_sent ENABLE ROW LEVEL SECURITY;

-- Nur Service-Role darf direkt zugreifen (API routes verwenden service_role key)
CREATE POLICY "Kein direkter Benutzer-Zugriff"
  ON push_notifications_sent FOR ALL
  USING (false);
