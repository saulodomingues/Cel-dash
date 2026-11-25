// Cotações disponíveis para o espaço ao lado do relógio. Compartilhado entre servidor e /admin.
// src 'awesome': AwesomeAPI (câmbio e cripto, gratuita, sem chave), par no formato "USD-BRL".
// src 'yahoo': gráfico do Yahoo Finance (índices; não oficial, com uns 15 min de atraso).
export const CATALOG = [
  { id: 'USD', label: 'USD', name: 'Dólar (R$)', src: 'awesome', pair: 'USD-BRL', kind: 'fx' },
  { id: 'EUR', label: 'EUR', name: 'Euro (R$)', src: 'awesome', pair: 'EUR-BRL', kind: 'fx' },
  { id: 'GBP', label: 'GBP', name: 'Libra (R$)', src: 'awesome', pair: 'GBP-BRL', kind: 'fx' },
  { id: 'CHF', label: 'CHF', name: 'Franco suíço (R$)', src: 'awesome', pair: 'CHF-BRL', kind: 'fx' },
  { id: 'CNY', label: 'CNY', name: 'Yuan (R$)', src: 'awesome', pair: 'CNY-BRL', kind: 'fx' },
  { id: 'ARS', label: 'ARS', name: 'Peso argentino (R$)', src: 'awesome', pair: 'ARS-BRL', kind: 'fx' },
  { id: 'JPY', label: 'JPY', name: 'Iene (R$)', src: 'awesome', pair: 'JPY-BRL', kind: 'fx' },
  { id: 'BTC', label: 'BTC', name: 'Bitcoin (US$)', src: 'awesome', pair: 'BTC-USD', kind: 'crypto' },
  { id: 'ETH', label: 'ETH', name: 'Ethereum (US$)', src: 'awesome', pair: 'ETH-USD', kind: 'crypto' },
  { id: 'IBOV', label: 'IBOV', name: 'Ibovespa', src: 'yahoo', symbol: '^BVSP', kind: 'index' },
  { id: 'SPX', label: 'S&P', name: 'S&P 500', src: 'yahoo', symbol: '^GSPC', kind: 'index' },
  { id: 'NDX', label: 'NASDAQ', name: 'Nasdaq Composite', src: 'yahoo', symbol: '^IXIC', kind: 'index' },
  { id: 'DJI', label: 'DOW', name: 'Dow Jones', src: 'yahoo', symbol: '^DJI', kind: 'index' },
  { id: 'DAX', label: 'DAX', name: 'DAX (Alemanha)', src: 'yahoo', symbol: '^GDAXI', kind: 'index' },
  { id: 'FTSE', label: 'FTSE', name: 'FTSE 100 (Reino Unido)', src: 'yahoo', symbol: '^FTSE', kind: 'index' },
  { id: 'N225', label: 'NIKKEI', name: 'Nikkei 225 (Japão)', src: 'yahoo', symbol: '^N225', kind: 'index' },
];
export const MAX_QUOTES = 6;
export const DEFAULT_QUOTES = ['USD', 'EUR', 'BTC', 'ETH', 'IBOV', 'SPX'];

// Valor curto para a coluna estreita: 5,42 · 98,4 mil · 3,41 mil · 6.012 · 131,2 mil
export function fmtQuote(v, kind) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  const n = (x, d) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (v >= 10000) return `${n(v / 1000, 1)} mil`;
  if (v >= 1000) return kind === 'index' ? n(v, 0) : `${n(v / 1000, 2)} mil`;
  if (v < 0.1) return n(v, 4);
  return n(v, 2);
}
