// Service worker mínimo: só existe para o Chrome oferecer "Instalar app" e abrir o painel
// em tela cheia. Não guarda nada em cache, para as atualizações chegarem na hora.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
