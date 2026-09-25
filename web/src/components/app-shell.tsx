'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/transfer', label: '振込' },
];

/** ログイン必須ページの共通レイアウト。未ログインなら /login へ戻す。 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return <div className="center-state">読み込み中...</div>;
  }

  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">N</span>
          Atlas Bank
        </Link>
        <nav className="nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={pathname === item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="user-chip">
            <span className="avatar">{user.fullName.slice(0, 1)}</span>
            {user.fullName}
          </span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </>
  );
}
