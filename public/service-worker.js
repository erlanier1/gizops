const CACHE_NAME = 'gizops-pos-v1';
const urlsToCache = [
  '/pos',
  '/pos-icon-192.png',
  '/pos-icon-512.png',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - cache first, fallback to network
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type === 'error'
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Fallback for offline
          return caches.match('/pos').then((response) => {
            return response || new Response('Offline - please check your connection');
          });
        });
    })
  );
});

// Background sync for pending transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  try {
    const db = await openDatabase();
    const pendingOrders = await getPendingOrders(db);

    for (const order of pendingOrders) {
      try {
        const response = await fetch('/api/pos/sync-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        });

        if (response.ok) {
          await markOrderSynced(db, order.id);
        }
      } catch (error) {
        console.error('Failed to sync order:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gizops-pos', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-orders')) {
        db.createObjectStore('pending-orders', { keyPath: 'id' });
      }
    };
  });
}

function getPendingOrders(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-orders', 'readonly');
    const store = transaction.objectStore('pending-orders');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function markOrderSynced(db, orderId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-orders', 'readwrite');
    const store = transaction.objectStore('pending-orders');
    const request = store.delete(orderId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
