"use client";

import { useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

/** Konvertiert einen Base64-URL-String in ein Uint8Array (für applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch (err) {
    console.warn("Push-Subscription fehlgeschlagen:", err);
  }
}

async function setupNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!window.localStorage.getItem("tf_logged_in")) return;

  // Service Worker registrieren
  const registration = await navigator.serviceWorker.register("/service-worker.js");

  // Warten bis SW aktiv ist
  await navigator.serviceWorker.ready;

  const permission = Notification.permission;

  if (permission === "default") {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      await subscribeToPush(registration);
    }
  } else if (permission === "granted") {
    // Bereits erlaubt – Subscription sicherstellen (z.B. nach Browser-Neustart)
    const existing = await registration.pushManager.getSubscription();
    if (!existing) {
      await subscribeToPush(registration);
    }
  }
}

export default function NotificationSetup() {
  useEffect(() => {
    setupNotifications().catch(console.warn);
  }, []);

  return null;
}

