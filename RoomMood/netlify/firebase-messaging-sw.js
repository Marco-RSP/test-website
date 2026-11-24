importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyDVBS96MAnAGuyWwqMb2WTbZAsh5b22mRM",
    authDomain: "roommood-c198a.firebaseapp.com",
    projectId: "roommood-c198a",
    storageBucket: "roommood-c198a.firebasestorage.app",
    messagingSenderId: "850202778777",
    appId: "1:850202778777:web:5f62811546b49f44766c08"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    self.registration.showNotification(data.title || "RoomMood", {
        body: data.body || "Wo bist du gerade und was machst du?",
        icon: "roommood_logo-192.png",
        tag: "roommood-daily-checkin",
        data: { url: self.registration.scope }
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const destination = event.notification.data?.url || self.registration.scope;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
            if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(destination);
    })());
});
