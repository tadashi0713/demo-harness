'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { status, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('hanako@example.com');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    if (next === 'register') {
      setEmail('');
      setPassword('');
    } else {
      setEmail('hanako@example.com');
      setPassword('password123');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, fullName });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信に失敗しました。API が起動しているか確認してください');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">N</span>
          Atlas Bank
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          {mode === 'login' ? 'アカウントにログインしてください' : '新しいアカウントを作成します'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className="auth-tab"
            data-active={mode === 'login'}
            onClick={() => switchMode('login')}
          >
            ログイン
          </button>
          <button
            type="button"
            className="auth-tab"
            data-active={mode === 'register'}
            onClick={() => switchMode('register')}
          >
            新規登録
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="fullName">氏名</label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="山田 太郎"
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
            {mode === 'register' && <span className="field-hint">8 文字以上で入力してください</span>}
          </div>

          {error && (
            <div className="alert" data-tone="error">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="demo-hint">
            デモ用アカウント
            <br />
            <code>hanako@example.com / password123</code>
            <br />
            <code>taro@example.com / password123</code>
          </div>
        )}
      </div>
    </div>
  );
}
