/* Pookie push service worker. Shows reminders while Pookie is closed.
 * Config arrives in the registration URL's query string (public values only). */
/* global importScripts, firebase, self, clients */
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  appId: params.get("appId"),
  messagingSenderId: params.get("messagingSenderId"),
});
const messaging = firebase.messaging();

// Notifications with a `notification` payload are shown by the SDK automatically.
// Clicking one opens Pookie, which then records that the reminder was delivered.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.data ? event.notification.data.FCM_MSG.data.notificationId : "";
  event.waitUntil(clients.openWindow("/home" + (id ? "?reminder=" + encodeURIComponent(id) : "")));
});
void messaging;
