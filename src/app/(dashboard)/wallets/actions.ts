'use server';

import { addWallet as createWallet, deleteWallet as removeWallet, getTrackedAddresses, getTrackedWalletsWithCooldown, getWallets as fetchWallets, toggleWalletFavorite as flipFavorite, updateWalletCooldowns, writeWallets } from '@/backend/wallet-service';
import type { Wallet } from '@/types/wallet';

export type { Wallet } from '@/types/wallet';

export async function getWallets(): Promise<Wallet[]> {
  return fetchWallets();
}

export async function addWallet(address: string): Promise<Wallet> {
  return createWallet(address);
}

export async function deleteWallet(address: string): Promise<void> {
  return removeWallet(address);
}

export async function toggleWalletFavorite(address: string): Promise<Wallet> {
  return flipFavorite(address);
}

export { getTrackedAddresses, getTrackedWalletsWithCooldown, updateWalletCooldowns, writeWallets };
