/* 忠生マラソン祭り マイページ - お知らせの通知を受けて表示する(外部ライブラリ不要) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) {}
  const n = (d && d.notification) || {};
  e.waitUntil(self.registration.showNotification(n.title || '忠生マラソン祭り',
    { body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('mypage.html');
  }));
});
