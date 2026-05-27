import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import webpush from "web-push";

// VAPID wird erst beim ersten Request initialisiert (Env-Vars sind nur zur Laufzeit verfügbar)
let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@terminfinder.de",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidInitialized = true;
}

// Admin-Client für Cross-User-Operationen (umgeht RLS)
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type NotificationType = "new_vote" | "vote_success_check" | "vote_deleted" | "change_check" | "event_cancelled";

const NOTIFICATION_LABELS: Record<string, { title: string; body: string; url: string }> = {
  new_vote: {
    title: "Neue Abstimmung",
    body: "Eine neue Terminabstimmung wurde erstellt.",
    url: "/verfuegbarkeit",
  },
  vote_success: {
    title: "Termin bestätigt!",
    body: "Der Termin findet statt – alle Zusagen sind bestätigt.",
    url: "/verfuegbarkeit",
  },
  vote_deleted: {
    title: "Abstimmung abgebrochen",
    body: "Eine Terminabstimmung wurde abgebrochen.",
    url: "/verfuegbarkeit",
  },
  event_cancelled: {
    title: "Bestätigter Termin abgesagt",
    body: "Ein bestätigter Termin wurde vom Initiator abgesagt.",
    url: "/verfuegbarkeit",
  },
  change_safe: {
    title: "Änderung bei bestätigtem Termin",
    body: "Jemand hat seine Verfügbarkeit geändert, bitte prüfe den Termin.",
    url: "/verfuegbarkeit",
  },
  change_danger: {
    title: "Termin in Gefahr",
    body: "Jemand hat seine Verfügbarkeit geändert, der Termin ist in Gefahr. Bitte prüfen.",
    url: "/verfuegbarkeit",
  },
};

// Datum für Benachrichtigungstext formatieren ("Mo, 6.6.")
function formatGermanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const dow = new Date(y, m - 1, d).getDay()
  return `${weekdays[dow]}, ${d}.${m}.`
}

interface EventContext {
  groupName: string
  date: string
}

async function sendPushToUsers(userIds: string[], notificationKey: string, ctx?: EventContext) {
  const admin = getAdminClient();
  const label = NOTIFICATION_LABELS[notificationKey];
  if (!label) return;

  // Alle Push-Subscriptions der betroffenen Nutzer laden
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  if (!subscriptions || subscriptions.length === 0) return;

  // Titel und Body mit Gruppenname + Datum anreichern
  let title = label.title
  let body = label.body
  if (ctx) {
    const dateStr = formatGermanDate(ctx.date)
    title = `${label.title} · ${ctx.groupName}`
    body = `${dateStr}: ${label.body}`
  }

  const payload = JSON.stringify({
    title,
    body,
    url: label.url,
  });

  // Parallel senden, Fehler bei abgelaufenen Subscriptions ignorieren
  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_key,
          },
        },
        payload
      ).catch((err) => {
        // HTTP 410 = Subscription abgelaufen, HTTP 401/403 = VAPID-Key ungültig → entfernen
        if (err?.statusCode === 410 || err?.statusCode === 401 || err?.statusCode === 403) {
          admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      })
    )
  );
}

async function checkDedup(eventId: string, type: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("push_notifications_sent")
    .select("id")
    .eq("event_id", eventId)
    .eq("notification_type", type)
    .maybeSingle();
  return data !== null;
}

async function markSent(eventId: string, type: string) {
  const admin = getAdminClient();
  await admin
    .from("push_notifications_sent")
    .insert({ event_id: eventId, notification_type: type });
}

export async function POST(req: NextRequest) {
  ensureVapid();
  // Caller muss eingeloggt sein
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, type } = (await req.json()) as { eventId: string; type: NotificationType };
  if (!eventId || !type) {
    return NextResponse.json({ error: "eventId und type erforderlich" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Event laden (inkl. Gruppenname für Benachrichtigungstext)
  const { data: event } = await admin
    .from("events")
    .select("id, group_id, status, min_participants, proposed_date, groups(name)")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });

  // Alle aktiven Gruppenmitglieder laden
  const { data: members } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", event.group_id)
    .eq("status", "active")
    .not("user_id", "is", null);

  const userIds = (members ?? []).map((m) => m.user_id as string).filter(Boolean);
  if (userIds.length === 0) return NextResponse.json({ ok: true, skipped: "no_members" });

  const ctx: EventContext = {
    groupName: (event.groups as any)?.name ?? 'Gruppe',
    date: event.proposed_date,
  }

  // ── Benachrichtigungstypen ──────────────────────────────────────────────

  if (type === "new_vote") {
    if (await checkDedup(eventId, "new_vote")) return NextResponse.json({ ok: true, dedup: true });
    await sendPushToUsers(userIds, "new_vote", ctx);
    await markSent(eventId, "new_vote");
    return NextResponse.json({ ok: true });
  }

  if (type === "vote_deleted") {
    if (await checkDedup(eventId, "vote_deleted")) return NextResponse.json({ ok: true, dedup: true });
    await sendPushToUsers(userIds, "vote_deleted", ctx);
    await markSent(eventId, "vote_deleted");
    return NextResponse.json({ ok: true });
  }

  if (type === "event_cancelled") {
    if (await checkDedup(eventId, "event_cancelled")) return NextResponse.json({ ok: true, dedup: true });
    await sendPushToUsers(userIds, "event_cancelled", ctx);
    await markSent(eventId, "event_cancelled");
    return NextResponse.json({ ok: true });
  }

  if (type === "vote_success_check") {
    if (event.status !== "confirmed") return NextResponse.json({ ok: true, skipped: "not_confirmed" });
    if (await checkDedup(eventId, "vote_success")) return NextResponse.json({ ok: true, dedup: true });
    await sendPushToUsers(userIds, "vote_success", ctx);
    await markSent(eventId, "vote_success");
    return NextResponse.json({ ok: true });
  }

  if (type === "change_check") {
    if (event.status !== "confirmed") return NextResponse.json({ ok: true, skipped: "not_confirmed" });

    // Fall 1 wurde bereits gesendet → keine weiteren Änderungs-Benachrichtigungen
    if (await checkDedup(eventId, "change_2")) return NextResponse.json({ ok: true, dedup: true });

    const { data: responses } = await admin
      .from("event_responses")
      .select("user_id, response, previous_response")
      .eq("event_id", eventId);

    const hasChange = (responses ?? []).some(
      (r) => r.previous_response === "accepted" && r.response !== "accepted"
    );
    if (!hasChange) return NextResponse.json({ ok: true, skipped: "no_change" });

    const acceptedCount = (responses ?? []).filter((r) => r.response === "accepted").length;

    // Fall 1: Mindestteilnehmerzahl unterschritten → kombinierte Gefahren-Meldung (einmalig, sperrt alle weiteren)
    if (acceptedCount < event.min_participants) {
      await sendPushToUsers(userIds, "change_danger", ctx);
      await markSent(eventId, "change_2");
      return NextResponse.json({ ok: true, sent: ["change_danger"] });
    }

    // Fall 2: Noch genug Teilnehmer → einmalige Hinweis-Meldung (Fall 1 kann danach noch folgen)
    if (await checkDedup(eventId, "change_1")) return NextResponse.json({ ok: true, dedup: true });
    await sendPushToUsers(userIds, "change_safe", ctx);
    await markSent(eventId, "change_1");
    return NextResponse.json({ ok: true, sent: ["change_safe"] });
  }

  return NextResponse.json({ error: "Unbekannter type" }, { status: 400 });
}
