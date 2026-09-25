'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  return <div className="center-state">読み込み中...</div>;
}
