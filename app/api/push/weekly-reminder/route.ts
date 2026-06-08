import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import webpush from "web-push";

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

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Vercel Cron sendet Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  ensureVapid();
  const admin = getAdminClient();

  // Aktuelle Woche: Montag bis Sonntag
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // "Neu hinzugekommene Woche" im 5-Wochen-Fenster:
  // aktuelle Woche (0) + 4 weitere Wochen => neue Woche ist Index 4 (Tage +28 bis +34)
  const newWeekStart = new Date(monday);
  newWeekStart.setDate(monday.getDate() + 28);
  const newWeekEnd = new Date(newWeekStart);
  newWeekEnd.setDate(newWeekStart.getDate() + 6);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);
  const newWeekStartStr = newWeekStart.toISOString().slice(0, 10);
  const newWeekEndStr = newWeekEnd.toISOString().slice(0, 10);

  // Alle Nutzer mit Push-Subscription laden
  const { data: subscribers } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth_key");

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, week: `${mondayStr} – ${sundayStr}` });
  }

  const allUserIds = [...new Set(subscribers.map((s) => s.user_id))];

  // Nutzer herausfiltern, die in der neu hinzugekommenen Woche bereits etwas eingetragen haben.
  // "Nichts eingetragen" entspricht überall busy (also keine availability-Zeile in dieser Woche).
  const { data: withAvail } = await admin
    .from("availability")
    .select("user_id")
    .in("user_id", allUserIds)
    .gte("date", newWeekStartStr)
    .lte("date", newWeekEndStr);

  const usersWithAvail = new Set((withAvail ?? []).map((a) => a.user_id));
  const usersToNotify = allUserIds.filter((id) => !usersWithAvail.has(id));

  if (usersToNotify.length === 0) {
    return NextResponse.json({ sent: 0, week: `${mondayStr} – ${sundayStr}`, targetWeek: `${newWeekStartStr} – ${newWeekEndStr}` });
  }

  const subsToNotify = subscribers.filter((s) => usersToNotify.includes(s.user_id));

  const payload = JSON.stringify({
    title: "Neue Woche freigeschaltet",
    body: "Du hast für die neu hinzugekommene Woche noch keine Verfügbarkeit eingetragen.",
    url: "/verfuegbarkeit",
  });

  let sent = 0;
  await Promise.allSettled(
    subsToNotify.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410) {
          // Abgelaufene Subscription entfernen
          admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    })
  );

  return NextResponse.json({ sent, week: `${mondayStr} – ${sundayStr}`, targetWeek: `${newWeekStartStr} – ${newWeekEndStr}` });
}
