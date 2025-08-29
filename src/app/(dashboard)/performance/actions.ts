'use server';

import { getTrackedAddresses } from "../wallets/actions";

export interface WalletPerformance {
    rank: number;
    address: string;
    successRate: number;
    pnl: number;
    trades: number;
}

// This function would fetch and process real data based on the timeframe.
export async function getPerformanceData(timeframe: string): Promise<WalletPerformance[]> {
    console.log(`Fetching performance data for timeframe: ${timeframe}`);
    const addresses = await getTrackedAddresses();
    
    // Mock data generation
    const data = addresses.map(address => ({
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        successRate: parseFloat((Math.random() * 60 + 40).toFixed(2)), // 40-100%
        pnl: parseFloat((Math.random() * 10000 - 2000).toFixed(2)), // -2000 to 8000
        trades: Math.floor(Math.random() * 200 + 10), // 10-210
    }));

    // Sort by PnL for ranking
    const sortedData = data.sort((a, b) => b.pnl - a.pnl);

    return sortedData.map((item, index) => ({
        ...item,
        rank: index + 1,
    }));
}
