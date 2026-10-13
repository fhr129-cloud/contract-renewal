// sw.js — 업데이트 후 옛 파일과 새 파일이 섞여 하얀 화면이 되는 걸 막는 용도.
// 이 사이트의 JS·CSS 파일은 매번 서버에 "바뀌었나?"를 확인하고 받는다 (바뀌지 않았으면 금방 끝남).
// 오프라인 저장은 하지 않는다.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(names){ return Promise.all(names.map(function(n){ return caches.delete(n); })); })
      .then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET' || req.mode === 'navigate') return;          // 페이지 이동은 브라우저 기본 동작
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;                      // Firebase·글꼴 등 외부는 건드리지 않음
  if(!/\.(js|css|json)$/.test(url.pathname)) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .catch(function(){ return fetch(req); })
  );
});
