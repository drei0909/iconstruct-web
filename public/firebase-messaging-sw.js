// public/firebase-messaging-sw.js
// ⚠️ This file MUST be in the /public folder, NOT in /src

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC4hyvv3ZtGWs0XmpeRgkIsJloFvahc6LI",
  authDomain: "iconstruct-58a87.firebaseapp.com",
  projectId: "iconstruct-58a87",
  storageBucket: "iconstruct-58a87.firebasestorage.app",
  messagingSenderId: "244045941716",
  appId: "1:244045941716:web:3a6b24865a2f29d7606441",
});

const messaging = firebase.messaging();

// Handles push when app tab is closed or in background
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const title = payload.notification?.title ?? "iConstruct";
  const body  = payload.notification?.body  ?? "You have a new notification.";

  self.registration.showNotification(title, {
    body: body,
    icon: "/favicon.svg",
  });
});

// When user clicks the notification — opens the dashboard
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin + "/shop/dashboard");
        }
      })
  );
});