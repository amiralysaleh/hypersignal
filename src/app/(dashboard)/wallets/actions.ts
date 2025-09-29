'use server';

import type { Wallet } from '@/server/services/wallets';
import {
  addWallet as addWalletService,
  deleteWallet as deleteWalletService,
  getTrackedAddresses as getTrackedAddressesService,
  getTrackedWalletsWithCooldown as getTrackedWalletsWithCooldownService,
  getWallets as getWalletsService,
  readWallets as readWalletsService,
  toggleWalletFavorite as toggleWalletFavoriteService,
  updateWalletCooldowns as updateWalletCooldownsService,
  writeWallets as writeWalletsService,
} from '@/server/services/wallets';

export type { Wallet };

export async function readWallets() {
  return readWalletsService();
}

export async function writeWallets(wallets: Wallet[]) {
  await writeWalletsService(wallets);
}

export async function getWallets(): Promise<Wallet[]> {
  return getWalletsService();
}

export async function addWallet(address: string): Promise<Wallet> {
  return addWalletService(address);
}

export async function deleteWallet(address: string): Promise<void> {
  await deleteWalletService(address);
}

export async function toggleWalletFavorite(address: string): Promise<Wallet> {
  return toggleWalletFavoriteService(address);
}

export async function getTrackedAddresses(): Promise<string[]> {
  return getTrackedAddressesService();
}

export async function getTrackedWalletsWithCooldown(): Promise<Wallet[]> {
  return getTrackedWalletsWithCooldownService();
}

export async function updateWalletCooldowns(walletAddresses: string[], coin: string): Promise<void> {
  await updateWalletCooldownsService(walletAddresses, coin);
}
