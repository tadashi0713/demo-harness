'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { TransactionList } from '@/components/transaction-list';
import { api, ApiError } from '@/lib/api';
import { accountKindLabel, formatDate, formatMoney } from '@/lib/format';
import type { Account, Transaction } from '@/lib/types';

export default function AccountPage() {
  return (
    <AppShell>
      <AccountDetail />
    </AppShell>
  );
}

function AccountDetail() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMessage, setDepositMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setError(null);
      const [accountResult, txResult] = await Promise.all([
        api.account(accountId),
        api.accountTransactions(accountId, 50),
      ]);
      setAccount(accountResult.account);
      setTransactions(txResult.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const amount = Number(depositAmount);
    setDepositMessage(null);
    setError(null);

    if (!Number.isInteger(amount) || amount <= 0) {
      setError('入金額は 1 以上の整数で入力してください');
      return;
    }

    setSubmitting(true);
    try {
      await api.deposit(accountId, amount, 'デモ入金');
      setDepositAmount('');
      setDepositMessage(`${formatMoney(amount, account?.currency)} を入金しました`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '入金に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="skeleton" style={{ height: 160 }} />;
  }

  if (!account) {
    return (
      <>
        <div className="alert" data-tone="error">
          {error ?? '口座が見つかりません'}
        </div>
        <p style={{ marginTop: 16 }}>
          <Link href="/dashboard" className="btn btn-ghost">
            ダッシュボードへ戻る
          </Link>
        </p>
      </>
    );
  }

  const credits = transactions.filter((tx) => tx.direction === 'credit');
  const debits = transactions.filter((tx) => tx.direction === 'debit');
  const sum = (list: Transaction[]) => list.reduce((total, tx) => total + tx.amount, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted" style={{ marginBottom: 4 }}>
            <Link href="/dashboard">← ダッシュボード</Link>
          </p>
          <h1 className="page-title">{account.name}</h1>
          <p className="account-number">
            {account.accountNumber} · {accountKindLabel[account.kind] ?? account.kind} ·{' '}
            {formatDate(account.createdAt)} 開設
          </p>
        </div>
        <Link href="/transfer" className="btn btn-primary">
          この口座から振込
        </Link>
      </div>

      {error && (
        <div className="alert" data-tone="error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}
      {depositMessage && (
        <div className="alert" data-tone="success" style={{ marginBottom: 18 }}>
          {depositMessage}
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 22 }}>
        <section className="hero">
          <div className="hero-label">現在の残高</div>
          <div className="hero-amount">{formatMoney(account.balance, account.currency)}</div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">明細サマリー（直近 {transactions.length} 件）</h2>
          </div>
          <div className="summary-row">
            <span>入金合計</span>
            <span>{formatMoney(sum(credits), account.currency)}</span>
          </div>
          <div className="summary-row">
            <span>出金合計</span>
            <span>{formatMoney(sum(debits), account.currency)}</span>
          </div>
          <div className="summary-row">
            <span>取引件数</span>
            <span>{transactions.length} 件</span>
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">デモ入金</h2>
          </div>
          <form className="form" onSubmit={handleDeposit}>
            <div className="field">
              <label htmlFor="amount">入金額</label>
              <input
                id="amount"
                type="number"
                min={1}
                step={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="10000"
                required
              />
              <span className="field-hint">動作確認用に残高を増やせます</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '処理中...' : '入金する'}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">取引履歴</h2>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              更新
            </button>
          </div>
          <TransactionList transactions={transactions} currency={account.currency} />
        </section>
      </div>
    </>
  );
}
