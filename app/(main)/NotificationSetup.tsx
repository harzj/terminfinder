"use client";

import { useEffect } from "react";

export default function NotificationSetup() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Permission erst nach Login fragen
      const user = window.localStorage.getItem('tf_logged_in')
      if (user) {
        Notification.requestPermission()
      }
    }
  }, [])

  return null;
}
