if (!localStorage.getItem('cache_cleared_v3')) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
      }
    });
  }
  localStorage.setItem('cache_cleared_v3', 'true');
  console.log("Stale cache and old service workers cleared once to apply updates.");
}

