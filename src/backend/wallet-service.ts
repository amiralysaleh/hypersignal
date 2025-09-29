import * as path from 'path';
import { readJsonFile, writeJsonFile } from './storage';
import { Wallet } from '@/types/wallet';

const WALLETS_FILE_PATH = path.resolve(process.cwd(), 'wallets.json');

export async function readWallets(): Promise<Wallet[]> {
  const wallets = await readJsonFile<Wallet[]>(WALLETS_FILE_PATH, []);
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
  if (wallets.some((wallet) => wallet.address.toLowerCase() === address.toLowerCase())) {
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
  const index = wallets.findIndex((wallet) => wallet.address.toLowerCase() === address.toLowerCase());
  if (index === -1) {
    throw new Error('Wallet not found.');
  }
  const updated = { ...wallets[index], favorite: !wallets[index].favorite };
  wallets[index] = updated;
  await writeWallets(wallets);
  return updated;
}

export async function getTrackedAddresses(): Promise<string[]> {
  const wallets = await readWallets();
  return wallets.map((wallet) => wallet.address);
}

export async function getTrackedWalletsWithCooldown(): Promise<Wallet[]> {
  return readWallets();
}

export async function updateWalletCooldowns(walletAddresses: string[], coin: string): Promise<void> {
  const wallets = await readWallets();
  const now = new Date().toISOString();
  walletAddresses.forEach((address) => {
    const index = wallets.findIndex((wallet) => wallet.address.toLowerCase() === address.toLowerCase());
    if (index !== -1) {
      wallets[index].cooldowns = wallets[index].cooldowns ?? {};
      wallets[index].cooldowns[coin] = now;
    }
  });
  await writeWallets(wallets);
}
