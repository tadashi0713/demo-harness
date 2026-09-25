import type { Account, Payee, Transaction, Transfer, User } from './types';

const TOKEN_KEY = 'atlasbank.token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  get: (): string | null => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (body as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(
      error?.message ?? `リクエストに失敗しました (${response.status})`,
      response.status,
      error?.code ?? 'error',
    );
  }

  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  accounts: () => request<{ accounts: Account[]; totalBalance: number }>('/api/accounts'),

  account: (accountId: string) => request<{ account: Account }>(`/api/accounts/${accountId}`),

  accountTransactions: (accountId: string, limit = 50) =>
    request<{ transactions: Transaction[] }>(`/api/accounts/${accountId}/transactions?limit=${limit}`),

  recentTransactions: (limit = 8) =>
    request<{ transactions: Transaction[] }>(`/api/transactions?limit=${limit}`),

  deposit: (accountId: string, amount: number, description?: string) =>
    request<{ account: Account; transaction: Transaction }>(`/api/accounts/${accountId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }),

  lookupPayee: (accountNumber: string) =>
    request<{ payee: Payee }>(`/api/transfers/payee?accountNumber=${encodeURIComponent(accountNumber)}`),

  transfer: (input: {
    fromAccountId: string;
    toAccountNumber: string;
    amount: number;
    description?: string;
  }) =>
    request<{ transfer: Transfer }>('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
