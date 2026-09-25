'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { TransactionList } from '@/components/transaction-list';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { accountKindLabel, formatMoney } from '@/lib/format';
import type { Account, Transaction } from '@/lib/types';

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [accountsResult, txResult] = await Promise.all([
        api.accounts(),
        api.recentTransactions(8),
      ]);
      setAccounts(accountsResult.accounts);
      setTotalBalance(accountsResult.totalBalance);
      setTransactions(txResult.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = accounts[0]?.currency ?? 'JPY';
  const monthlyIn = transactions
    .filter((tx) => tx.direction === 'credit')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyOut = transactions
    .filter((tx) => tx.direction === 'debit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">こんにちは、{user?.fullName} さん</h1>
          <p className="muted">口座の状況と最近の取引をまとめて確認できます</p>
        </div>
        <Link href="/transfer" className="btn btn-primary">
          振込する
        </Link>
      </div>

      {error && (
        <div className="alert" data-tone="error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-2">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : (
        <div className="grid" style={{ gap: 22 }}>
          <section className="hero">
            <div className="hero-label">総資産</div>
            <div className="hero-amount">{formatMoney(totalBalance, currency)}</div>
            <p className="muted" style={{ marginBottom: 0 }}>
              {accounts.length} 件の口座 · 直近の入金 {formatMoney(monthlyIn, currency)} / 出金{' '}
              {formatMoney(monthlyOut, currency)}
            </p>
          </section>

          <section>
            <div className="card-header">
              <h2 className="card-title">口座一覧</h2>
              <span className="muted">クリックで明細を表示</span>
            </div>
            <div className="grid grid-3">
              {accounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`} className="account-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="account-name">{account.name}</span>
                    <span className="badge">{accountKindLabel[account.kind] ?? account.kind}</span>
                  </div>
                  <div className="account-number">{account.accountNumber}</div>
                  <div className="account-balance">{formatMoney(account.balance, account.currency)}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">最近の取引</h2>
              <button type="button" className="btn btn-ghost" onClick={() => void load()}>
                更新
              </button>
            </div>
            <TransactionList transactions={transactions} currency={currency} showBalance={false} />
          </section>
        </div>
      )}
    </>
  );
}
