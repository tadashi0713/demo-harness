const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  const cached = currencyFormatters.get(currency);
  if (cached) return cached;
  const created = new Intl.NumberFormat('ja-JP', { style: 'currency', currency });
  currencyFormatters.set(currency, created);
  return created;
}

/** 金額は最小通貨単位の整数で保持している（JPY なら円） */
export function formatMoney(amount: number, currency = 'JPY'): string {
  return formatter(currency).format(amount);
}

export function formatSignedMoney(amount: number, direction: 'credit' | 'debit', currency = 'JPY'): string {
  const sign = direction === 'credit' ? '+' : '-';
  return `${sign}${formatMoney(amount, currency)}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

export const accountKindLabel: Record<string, string> = {
  checking: '普通預金',
  savings: '貯蓄預金',
};

export const transactionKindLabel: Record<string, string> = {
  deposit: '入金',
  withdrawal: '出金',
  transfer: '振込',
};
