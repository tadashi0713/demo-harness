'use client';

import { formatDateTime, formatSignedMoney, transactionKindLabel } from '@/lib/format';
import type { Transaction } from '@/lib/types';

const ICONS: Record<Transaction['kind'], string> = {
  deposit: '↓',
  withdrawal: '↑',
  transfer: '⇄',
};

function metaText(tx: Transaction): string {
  const kind = transactionKindLabel[tx.kind] ?? tx.kind;
  if (tx.kind === 'transfer' && tx.peerAccountNumber) {
    const prefix = tx.direction === 'debit' ? '振込先' : '振込元';
    return `${kind} · ${prefix} ${tx.peerAccountNumber} · ${formatDateTime(tx.createdAt)}`;
  }
  return `${kind} · ${formatDateTime(tx.createdAt)}`;
}

export function TransactionList({
  transactions,
  currency = 'JPY',
  showBalance = true,
  emptyMessage = '取引履歴はまだありません',
}: {
  transactions: Transaction[];
  currency?: string;
  showBalance?: boolean;
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  return (
    <div className="tx-list">
      {transactions.map((tx) => (
        <div key={tx.id} className="tx-row">
          <span className="tx-icon">{ICONS[tx.kind]}</span>
          <div className="tx-main">
            <div className="tx-title">{tx.description || transactionKindLabel[tx.kind]}</div>
            <div className="tx-meta">{metaText(tx)}</div>
          </div>
          <div className="tx-amounts">
            <div className="tx-amount" data-direction={tx.direction}>
              {formatSignedMoney(tx.amount, tx.direction, currency)}
            </div>
            {showBalance && (
              <div className="tx-meta">
                残高 {new Intl.NumberFormat('ja-JP').format(tx.balanceAfter)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
