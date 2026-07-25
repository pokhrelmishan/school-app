import * as SecureStore from 'expo-secure-store';

const ACCOUNTS_KEY = 'saved_accounts';

export interface SavedAccount {
  email: string;
  password: string;
  full_name?: string;
  role?: string;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const exists = accounts.findIndex(a => a.email === account.email);
  if (exists >= 0) {
    accounts[exists] = account;
  } else {
    accounts.push(account);
  }
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function removeAccount(email: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(a => a.email !== email);
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(filtered));
}
