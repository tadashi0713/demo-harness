export type User = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
};

export type Account = {
  id: string;
  accountNumber: string;
  name: string;
  kind: 'checking' | 'savings';
  currency: string;
  balance: number;
  createdAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  direction: 'credit' | 'debit';
  kind: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  peerAccountNumber: string | null;
  peerAccountName: string | null;
};

export type Payee = {
  accountNumber: string;
  accountName: string;
  ownerName: string;
};

export type Transfer = {
  transferId: string;
  amount: number;
  description: string;
  from: { accountId: string; accountNumber: string; balanceAfter: number };
  to: Payee;
  account: Account;
};
