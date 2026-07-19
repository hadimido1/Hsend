if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      if (registration.active && registration.active.scriptURL.includes('sw.js') && !registration.active.scriptURL.includes('workbox')) {
        registration.unregister();
      }
    }
  });
  caches.keys().then(function(names) {
    for (let name of names) {
      if (name.startsWith('hisend-cache-v1')) {
        caches.delete(name);
      }
    }
  });
}
