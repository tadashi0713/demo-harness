'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Account, Payee, Transfer } from '@/lib/types';

export default function TransferPage() {
  return (
    <AppShell>
      <TransferForm />
    </AppShell>
  );
}

function TransferForm() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState<Payee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transfer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .accounts()
      .then(({ accounts: list }) => {
        setAccounts(list);
        setFromAccountId(list[0]?.id ?? '');
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : '口座の取得に失敗しました'),
      );
  }, []);

  // 口座番号が 0000-0000 形式になったら受取人を照会する
  useEffect(() => {
    if (!/^\d{4}-\d{4}$/.test(toAccountNumber)) {
      setPayee(null);
      return;
    }
    let cancelled = false;
    api
      .lookupPayee(toAccountNumber)
      .then(({ payee: found }) => {
        if (!cancelled) setPayee(found);
      })
      .catch(() => {
        if (!cancelled) setPayee(null);
      });
    return () => {
      cancelled = true;
    };
  }, [toAccountNumber]);

  const selected = accounts.find((account) => account.id === fromAccountId);
  const amountValue = Number(amount);
  const insufficient = Boolean(selected && amountValue > selected.balance);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!Number.isInteger(amountValue) || amountValue <= 0) {
      setError('金額は 1 以上の整数で入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const { transfer } = await api.transfer({
        fromAccountId,
        toAccountNumber,
        amount: amountValue,
        description: description || undefined,
      });
      setResult(transfer);
      setAmount('');
      setDescription('');
      setToAccountNumber('');
      const refreshed = await api.accounts();
      setAccounts(refreshed.accounts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '振込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">振込</h1>
          <p className="muted">口座番号を指定して他の口座へ送金します</p>
        </div>
        <Link href="/dashboard" className="btn btn-ghost">
          ダッシュボードへ
        </Link>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="from">送金元の口座</label>
              <select
                id="from"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}（{account.accountNumber}） 残高{' '}
                    {formatMoney(account.balance, account.currency)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="to">振込先の口座番号</label>
              <input
                id="to"
                value={toAccountNumber}
                onChange={(e) => setToAccountNumber(e.target.value)}
                placeholder="2000-0001"
                pattern="\d{4}-\d{4}"
                required
              />
              <span className="field-hint">
                {payee ? `受取人: ${payee.ownerName}（${payee.accountName}）` : '例: 2000-0001'}
              </span>
            </div>

            <div className="field">
              <label htmlFor="transfer-amount">金額</label>
              <input
                id="transfer-amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                required
              />
              {insufficient && <span className="field-hint">残高が不足しています</span>}
            </div>

            <div className="field">
              <label htmlFor="description">摘要（任意）</label>
              <input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="家賃の支払い"
                maxLength={120}
              />
            </div>

            {error && (
              <div className="alert" data-tone="error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || insufficient || !fromAccountId}
            >
              {submitting ? '送金中...' : '振込を実行'}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">振込結果</h2>
          </div>
          {result ? (
            <>
              <div className="alert" data-tone="success" style={{ marginBottom: 16 }}>
                振込が完了しました
              </div>
              <div className="summary-row">
                <span>振込先</span>
                <span>
                  {result.to.ownerName}（{result.to.accountNumber}）
                </span>
              </div>
              <div className="summary-row">
                <span>金額</span>
                <span>{formatMoney(result.amount, result.account.currency)}</span>
              </div>
              <div className="summary-row">
                <span>摘要</span>
                <span>{result.description}</span>
              </div>
              <div className="summary-row">
                <span>振込後の残高</span>
                <span>{formatMoney(result.from.balanceAfter, result.account.currency)}</span>
              </div>
              <div className="summary-row">
                <span>受付番号</span>
                <span style={{ fontSize: 12 }}>{result.transferId}</span>
              </div>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <Link href={`/accounts/${result.from.accountId}`} className="btn btn-ghost">
                  明細を確認
                </Link>
              </div>
            </>
          ) : (
            <div className="alert" data-tone="info">
              デモデータの <code>2000-0001</code>（鈴木 太郎）や、自分の別口座宛にも振込できます。
              残高不足の場合はサーバー側でロールバックされ、残高は変わりません。
            </div>
          )}
        </section>
      </div>
    </>
  );
}
