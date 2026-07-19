importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAeKEusFY1tMW2aG-H6ARLcCVgDvM2C53g",
  authDomain: "hsend-b74f2.firebaseapp.com",
  projectId: "hsend-b74f2",
  storageBucket: "hsend-b74f2.firebasestorage.app",
  messagingSenderId: "242682879423",
  appId: "1:242682879423:web:019172f4d32630dea8550a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  if (payload.data && payload.data.type === 'call') {
      const notificationTitle = 'مكالمة واردة من ' + (payload.data.callerName || 'شخص ما');
      const notificationOptions = {
        body: 'انقر للرد على المكالمة',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
        data: payload.data,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200, 100, 200]
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
  } else if (payload.notification) {
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
        data: payload.data,
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;
    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url === urlToOpen) {
        matchingClient = windowClient;
        break;
      }
    }
    if (matchingClient) {
      return matchingClient.focus();
    } else {
      return clients.openWindow(urlToOpen);
    }
  });
  event.waitUntil(promiseChain);
});
