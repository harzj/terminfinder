import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import webpush from "web-push";
import { clampPlanningMonths, toLocalDateString } from "@/lib/planningWindow";

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

  const mondayStr = toLocalDateString(monday);
  const sundayStr = toLocalDateString(sunday);

  // Alle Nutzer mit Push-Subscription laden
  const { data: subscribers } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth_key");

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, week: `${mondayStr} – ${sundayStr}` });
  }

  const allUserIds = [...new Set(subscribers.map((s) => s.user_id))];

  // Je Nutzer die Zielfenster-Woche bestimmen: aktuelle Woche + 4*Monate.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, availability_planning_months")
    .in("id", allUserIds);

  const planningMonthsByUser = new Map(
    (profiles ?? []).map((p) => [p.id, clampPlanningMonths(p.availability_planning_months)])
  );

  const targetWeekByUser = new Map<string, { start: string; end: string }>();
  for (const userId of allUserIds) {
    const months = planningMonthsByUser.get(userId) ?? 1;
    const start = new Date(monday);
    start.setDate(monday.getDate() + 28 * months);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    targetWeekByUser.set(userId, {
      start: toLocalDateString(start),
      end: toLocalDateString(end),
    });
  }

  const allTargetStarts = [...targetWeekByUser.values()].map((w) => w.start).sort();
  const allTargetEnds = [...targetWeekByUser.values()].map((w) => w.end).sort();
  const minTargetStart = allTargetStarts[0];
  const maxTargetEnd = allTargetEnds[allTargetEnds.length - 1];

  // Nutzer herausfiltern, die in der neu hinzugekommenen Woche bereits etwas eingetragen haben.
  // "Nichts eingetragen" entspricht überall busy (also keine availability-Zeile in dieser Woche).
  const { data: withAvail } = await admin
    .from("availability")
    .select("user_id, date")
    .in("user_id", allUserIds)
    .gte("date", minTargetStart)
    .lte("date", maxTargetEnd);

  const availDatesByUser = new Map<string, Set<string>>();
  for (const row of withAvail ?? []) {
    if (!availDatesByUser.has(row.user_id)) {
      availDatesByUser.set(row.user_id, new Set());
    }
    availDatesByUser.get(row.user_id)!.add(row.date);
  }

  const usersToNotify = allUserIds.filter((userId) => {
    const week = targetWeekByUser.get(userId);
    if (!week) return false;
    const userDates = availDatesByUser.get(userId) ?? new Set<string>();
    const start = new Date(week.start);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateString(d);
      if (userDates.has(key)) return false;
    }
    return true;
  });

  if (usersToNotify.length === 0) {
    return NextResponse.json({ sent: 0, week: `${mondayStr} – ${sundayStr}`, targetWeeks: `${minTargetStart} – ${maxTargetEnd}` });
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

  return NextResponse.json({ sent, week: `${mondayStr} – ${sundayStr}`, targetWeeks: `${minTargetStart} – ${maxTargetEnd}` });
}
