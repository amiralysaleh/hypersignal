
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

const WALLETS_FILE_PATH = path.resolve(process.cwd(), 'wallets.json');

export type Wallet = {
  address: string;
  addedOn: string;
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  cooldowns: { [coin: string]: string }; // e.g. { "BTC": "2023-01-01T00:00:00.000Z" }
  favorite: boolean;
};

export async function readWallets(): Promise<Wallet[]> {
  try {
    await fs.access(WALLETS_FILE_PATH);
    const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
    if (!fileContent) {
        return [];
    }
    // Ensure data integrity with new fields
    const wallets = JSON.parse(fileContent);
    return wallets.map((w: any) => ({
      address: w.address,
      addedOn: w.addedOn,
      totalPnl: w.totalPnl || 0,
      totalTrades: w.totalTrades || 0,
      winningTrades: w.winningTrades || 0,
      cooldowns: w.cooldowns || {},
      favorite: w.favorite || false,
    }));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(WALLETS_FILE_PATH, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

export async function writeWallets(wallets: Wallet[]): Promise<void> {
  await fs.writeFile(WALLETS_FILE_PATH, JSON.stringify(wallets, null, 2));
}

export async function getWallets(): Promise<Wallet[]> {
  return await readWallets();
}

export async function addWallet(address: string): Promise<Wallet> {
  const wallets = await readWallets();
  const existingWallet = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());

  if (existingWallet) {
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
  let wallets = await readWallets();
  const initialLength = wallets.length;
  wallets = wallets.filter((w) => w.address.toLowerCase() !== address.toLowerCase());

  if (wallets.length === initialLength) {
    throw new Error('Wallet not found.');
  }

  await writeWallets(wallets);
}

export async function toggleWalletFavorite(address: string): Promise<Wallet> {
    const wallets = await readWallets();
    const walletIndex = wallets.findIndex((w) => w.address.toLowerCase() === address.toLowerCase());

    if (walletIndex === -1) {
        throw new Error('Wallet not found.');
    }

    wallets[walletIndex].favorite = !wallets[walletIndex].favorite;
    await writeWallets(wallets);
    return wallets[walletIndex];
}

export async function getTrackedAddresses(): Promise<string[]> {
    const wallets = await readWallets();
    return wallets.map(w => w.address);
}

// A new function to get all wallet data including cooldowns
export async function getTrackedWalletsWithCooldown(): Promise<Wallet[]> {
    return await readWallets();
}

// A new function to update cooldowns for participating wallets
export async function updateWalletCooldowns(walletAddresses: string[], coin: string): Promise<void> {
    const wallets = await readWallets();
    const now = new Date().toISOString();
    walletAddresses.forEach(address => {
        const walletIndex = wallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
        if (walletIndex > -1) {
            if (!wallets[walletIndex].cooldowns) {
                wallets[walletIndex].cooldowns = {};
            }
            wallets[walletIndex].cooldowns[coin] = now;
        }
    });
    await writeWallets(wallets);
}

