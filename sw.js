const CACHE_NAME = 'fs-app-v3';
const urlsToCache = ['/contract-renewal/'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(urlsToCache); }));
});
self.addEventListener('fetch', function(e){
  e.respondWith(caches.match(e.request).then(function(response){ return response||fetch(e.request); }));
});
