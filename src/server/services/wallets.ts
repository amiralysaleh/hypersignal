import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const WALLETS_FILE_PATH = 'wallets.json';

export type Wallet = {
  address: string;
  addedOn: string;
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  cooldowns: { [coin: string]: string };
  favorite: boolean;
};

const defaultWallets: Wallet[] = [];

export async function readWallets(): Promise<Wallet[]> {
  const wallets = await readJsonFile(WALLETS_FILE_PATH, defaultWallets);
  return wallets.map((wallet) => ({
    address: wallet.address,
    addedOn: wallet.addedOn,
    totalPnl: wallet.totalPnl ?? 0,
    totalTrades: wallet.totalTrades ?? 0,
    winningTrades: wallet.winningTrades ?? 0,
    cooldowns: wallet.cooldowns ?? {},
    favorite: wallet.favorite ?? false,
  }));
}

export async function writeWallets(wallets: Wallet[]): Promise<void> {
  await writeJsonFile(WALLETS_FILE_PATH, wallets);
}

export async function getWallets(): Promise<Wallet[]> {
  return readWallets();
}

export async function addWallet(address: string): Promise<Wallet> {
  const wallets = await readWallets();
  const normalized = address.trim().toLowerCase();

  if (!normalized) {
    throw new Error('Wallet address cannot be empty.');
  }

  if (wallets.some((wallet) => wallet.address.toLowerCase() === normalized)) {
    throw new Error('Wallet address already exists.');
  }

  const newWallet: Wallet = {
    address,
    addedOn: new Date().toISOString(),
    totalPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    cooldowns: {},
    favorite: false,
  };

  wallets.push(newWallet);
  await writeWallets(wallets);
  return newWallet;
}

export async function deleteWallet(address: string): Promise<void> {
  const wallets = await readWallets();
  const filtered = wallets.filter((wallet) => wallet.address.toLowerCase() !== address.toLowerCase());
  if (filtered.length === wallets.length) {
    throw new Error('Wallet not found.');
  }
  await writeWallets(filtered);
}

export async function toggleWalletFavorite(address: string): Promise<Wallet> {
  const wallets = await readWallets();
  const idx = wallets.findIndex((wallet) => wallet.address.toLowerCase() === address.toLowerCase());
  if (idx === -1) {
    throw new Error('Wallet not found.');
  }
  wallets[idx].favorite = !wallets[idx].favorite;
  await writeWallets(wallets);
  return wallets[idx];
}

export async function getTrackedAddresses(): Promise<string[]> {
  const wallets = await readWallets();
  return wallets.map((wallet) => wallet.address);
}

export async function getTrackedWalletsWithCooldown(): Promise<Wallet[]> {
  return readWallets();
}

export async function updateWalletCooldowns(walletAddresses: string[], coin: string): Promise<void> {
  if (walletAddresses.length === 0) {
    return;
  }
  const wallets = await readWallets();
  const now = new Date().toISOString();

  walletAddresses.forEach((address) => {
    const idx = wallets.findIndex((wallet) => wallet.address.toLowerCase() === address.toLowerCase());
    if (idx > -1) {
      wallets[idx].cooldowns = wallets[idx].cooldowns ?? {};
      wallets[idx].cooldowns[coin] = now;
    }
  });

  await writeWallets(wallets);
}
