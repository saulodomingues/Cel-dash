// Fontes de manchetes (feeds RSS/Atom públicos, sem cadastro). Compartilhado entre servidor e /admin.
// Endereços conferidos de memória; se algum mudar, o /admin mostra o erro e dá para colar o novo.
export const FEEDS = [
  { id: 'g1', name: 'g1', url: 'https://g1.globo.com/rss/g1/' },
  { id: 'folha', name: 'Folha', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml' },
  { id: 'bbc', name: 'BBC Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },
  { id: 'agbrasil', name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },
  { id: 'cnnbr', name: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/' },
  { id: 'uol', name: 'UOL', url: 'https://rss.uol.com.br/feed/noticias.xml' },
  { id: 'tecnoblog', name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
  { id: 'tecmundo', name: 'TecMundo', url: 'https://rss.tecmundo.com.br/feed' },
];
export const DEFAULT_FEEDS = ['g1', 'folha', 'bbc', 'agbrasil', 'tecnoblog'];
export const CRAWL_SPEED = { lenta: 45, normal: 70, rapida: 100 }; // px por segundo
