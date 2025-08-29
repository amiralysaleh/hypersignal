
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';
import { getTrackedWalletsWithCooldown, readWallets, writeWallets, updateWalletCooldowns } from "../wallets/actions";
import { getSettings, Settings } from "../settings/actions";
import { log } from '../logs/actions';

const SIGNALS_FILE_PATH = path.resolve(process.cwd(), 'signals.json');

export interface Signal {
    id: string;
    pair: string;
    type: 'LONG' | 'SHORT';
    entryPrice: string;
    currentPrice: string;
    pnl: string;
    roi: string;
    status: 'Open' | 'TP' | 'SL';
    timestamp: string;
    leverage: string;
    liquidationPrice: string;
    margin: string;
    size: string;
    contributingWallets: number;
    contributingWalletAddresses: string[];
    takeProfitTargets: string[];
    stopLoss: string;
    clusterFills?: any[];
}

async function readSignals(): Promise<Signal[]> {
  try {
    await fs.access(SIGNALS_FILE_PATH);
    const fileContent = await fs.readFile(SIGNALS_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(SIGNALS_FILE_PATH, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

async function writeSignals(signals: Signal[]): Promise<void> {
  await fs.writeFile(SIGNALS_FILE_PATH, JSON.stringify(signals, null, 2));
}

// Fetch current price for a given coin
async function getMarkPrice(coin: string): Promise<string> {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "allMids" }),
        });
        if (!response.ok) {
            await log({ level: 'WARN', message: `Failed to fetch mark price for ${coin}`, context: { status: response.status } });
            return '0.00';
        }
        const data = await response.json();
        return data[coin] ?? '0.00';
    } catch (error: any) {
        await log({ level: 'ERROR', message: `Failed to fetch mark price for ${coin}`, context: { error: error.message } });
        return '0.00';
    }
}

// We need a separate call for fills as it's a different endpoint
async function getUserFills(address: string): Promise<any[]> {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user: address }),
        });
        if (!response.ok) {
            await log({ level: 'WARN', message: `API call for userFills failed for ${address}`, context: { status: response.status } });
            return [];
        }
        return await response.json();
    } catch(e: any) {
        await log({ level: 'ERROR', message: `Failed to fetch user fills for ${address}`, context: { error: e.message } });
        return [];
    }
}

async function sendTelegramMessage(signal: Signal, settings: Settings) {
    const { telegramBotToken, telegramChannelIds } = settings;
    if (!telegramBotToken || !telegramChannelIds) {
        await log({ level: 'INFO', message: `Telegram settings are not configured. Skipping notification for signal ${signal.id}.` });
        return;
    }

    const direction = signal.type === 'LONG' ? '⬆️ LONG' : '⬇️ SHORT';
    const message = `
*New Signal Detected!*
-----------------------------------
*${signal.pair}-USDC*
*Direction:* ${direction}
-----------------------------------
*Entry Price:* ${signal.entryPrice}
*Total Margin:* $${signal.margin}
*Avg. Leverage:* ${signal.leverage}x
*Consensus:* ${signal.contributingWallets} wallets
-----------------------------------
*Stop Loss:* ${signal.stopLoss}
*Take Profit Targets:*
${signal.takeProfitTargets.map((tp, i) => `TP ${i + 1}: ${tp}`).join('\n')}
-----------------------------------
[View Dashboard](https://your-dashboard-url.com/signals) | [View Chart](https://www.tradingview.com/symbols/${signal.pair}USDC/)

    `.trim();

    const channels = telegramChannelIds.split(',').map(id => id.trim()).filter(id => id);

    for (const channelId of channels) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: channelId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            const result = await response.json();
            if (result.ok) {
                await log({ level: 'INFO', message: `Telegram message sent to channel ${channelId} for signal ${signal.id}` });
            } else {
                await log({ level: 'ERROR', message: `Failed to send message to channel ${channelId} for signal ${signal.id}`, context: result });
            }
        } catch (error: any) {
            await log({ level: 'ERROR', message: `Error sending message to channel ${channelId}`, context: { error: error.message } });
        }
    }
}

export async function detectAndSaveSignals(): Promise<void> {
    const walletsWithCooldown = await getTrackedWalletsWithCooldown();
    const trackedAddresses = walletsWithCooldown.map(w => w.address);
    const settings = await getSettings();
    const { minWalletCount, timeWindow, minVolume, defaultStopLoss, takeProfitTargets: tpTargetsSetting } = settings;
    
    if (trackedAddresses.length === 0 || minWalletCount <= 0 || timeWindow <= 0) {
        await log({ level: 'INFO', message: "Signal detection skipped: Insufficient configuration or no tracked wallets." });
        return;
    }

    const allFillsPromises = trackedAddresses.map(address => getUserFills(address).then(fills => ({ address, fills: fills || [] })));
    const allFillsResults = await Promise.all(allFillsPromises);

    const timeWindowMs = timeWindow * 60 * 1000;
    const cooldownMs = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    // Step 1: Filter all fills to only include recent, valid opening trades from wallets not on cooldown
    const recentOpeningFills: any[] = [];
    const walletDataMap = new Map(walletsWithCooldown.map(w => [w.address.toLowerCase(), w]));

    allFillsResults.forEach(({ address, fills }) => {
        fills.forEach(fill => {
            const isRecent = now - fill.time < timeWindowMs;
            
            // Reliable way to determine if a trade is opening a position
            const startPosition = parseFloat(fill.startPosition);
            const tradeSize = parseFloat(fill.sz);
            const isOpeningTrade = (fill.side === 'B' && startPosition >= 0 && tradeSize > 0) || // Buying to open/increase a long
                                   (fill.side === 'A' && startPosition <= 0 && tradeSize > 0);   // Selling to open/increase a short
            
            if (isRecent && isOpeningTrade) {
                const wallet = walletDataMap.get(address.toLowerCase());
                const cooldownTimestamp = wallet?.cooldowns?.[fill.coin];
                const isOnCooldown = cooldownTimestamp && (now - new Date(cooldownTimestamp).getTime() < cooldownMs);
                
                if (!isOnCooldown) {
                    recentOpeningFills.push({ ...fill, walletAddress: address });
                }
            }
        });
    });

    if (recentOpeningFills.length === 0) {
      await log({ level: 'INFO', message: "No recent opening fills meeting criteria found." });
      return;
    }

    // Step 2: Group these fills by their potential signal (e.g., "ETH-LONG")
    const fillsByPosition: { [key: string]: any[] } = {};
    for (const fill of recentOpeningFills) {
        const type = fill.side === 'B' ? 'LONG' : 'SHORT';
        const key = `${fill.coin}-${type}`;
        if (!fillsByPosition[key]) {
            fillsByPosition[key] = [];
        }
        fillsByPosition[key].push(fill);
    }
    
    const existingSignals = await readSignals();
    let newSignalsWereAdded = false;

    // Step 3: Analyze each group to find valid signal clusters
    for (const key in fillsByPosition) {
        const positionFills = fillsByPosition[key].sort((a, b) => a.time - b.time);
        
        let bestCluster: any[] | null = null;

        // Iterate through the fills to find the best consensus window
        for (let i = 0; i < positionFills.length; i++) {
            const anchorFill = positionFills[i];
            const windowEndTime = anchorFill.time + timeWindowMs;
            
            const currentWindowFills = positionFills.filter(f => f.time >= anchorFill.time && f.time < windowEndTime);
            const uniqueWalletsInWindow = new Set(currentWindowFills.map(f => f.walletAddress));

            if (uniqueWalletsInWindow.size >= minWalletCount) {
                if (!bestCluster || uniqueWalletsInWindow.size > new Set(bestCluster.map(f => f.walletAddress)).size) {
                    bestCluster = currentWindowFills;
                }
            }
        }

        if (!bestCluster) {
            continue;
        }
        
        const totalVolume = bestCluster.reduce((sum, fill) => sum + (parseFloat(fill.px) * Math.abs(parseFloat(fill.sz))), 0);
        if (totalVolume < minVolume) {
            continue;
        }

        const { coin, side } = bestCluster[0];
        const type = side === 'B' ? 'LONG' : 'SHORT';
        const signalTimestamp = bestCluster.reduce((latest, fill) => Math.max(latest, fill.time), 0);
        const signalId = `${coin}-${type}-${signalTimestamp}`;

        if (existingSignals.some(s => s.id === signalId)) {
            continue;
        }
        
        const participatingWallets = Array.from(new Set(bestCluster.map(f => f.walletAddress)));
        
        const totalSize = bestCluster.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0);
        const totalCost = bestCluster.reduce((acc, fill) => acc + (parseFloat(fill.px) * Math.abs(parseFloat(fill.sz))), 0);
        const avgEntryPrice = totalSize > 0 ? totalCost / totalSize : 0;

        const currentPriceStr = await getMarkPrice(coin) ?? '0.00';
        const currentPrice = parseFloat(currentPriceStr);
        
        const pnl = totalSize > 0 ? (currentPrice - avgEntryPrice) * totalSize * (type === 'LONG' ? 1 : -1) : 0;
        
        const { totalMargin, totalLeverageValue, leverageCount } = bestCluster.reduce((acc, fill) => {
             const leverage = fill.leverage?.value ? parseFloat(fill.leverage.value) : 10;
             const fillSize = Math.abs(parseFloat(fill.sz));
             const fillPrice = parseFloat(fill.px);
             acc.totalMargin += (fillPrice * fillSize) / leverage;
             acc.totalLeverageValue += leverage;
             acc.leverageCount += 1;
             return acc;
        }, { totalMargin: 0, totalLeverageValue: 0, leverageCount: 0 });

        const avgLeverage = leverageCount > 0 ? totalLeverageValue / leverageCount : 10;
        const roi = totalMargin > 0 ? (pnl / totalMargin) * 100 : 0;

        const tpTargets = tpTargetsSetting.split(',').map(t => t.trim()).filter(t => t);
        const takeProfitLevels = tpTargets.map(target => {
            const multiplier = parseFloat(target) / 100;
            return type === 'LONG'
                ? (avgEntryPrice * (1 + multiplier)).toFixed(4)
                : (avgEntryPrice * (1 - multiplier)).toFixed(4);
        });

        const stopLossLevel = type === 'LONG' 
            ? (avgEntryPrice * (1 + (defaultStopLoss / 100))).toFixed(4)
            : (avgEntryPrice * (1 - (defaultStopLoss / 100))).toFixed(4);

        const newSignal: Signal = {
            id: signalId,
            pair: coin,
            type: type,
            entryPrice: avgEntryPrice.toFixed(4),
            pnl: pnl.toFixed(2),
            roi: roi.toFixed(2),
            status: 'Open',
            timestamp: new Date(signalTimestamp).toISOString(),
            leverage: avgLeverage.toFixed(2),
            liquidationPrice: 'N/A',
            margin: totalMargin.toFixed(2),
            size: totalSize.toFixed(4),
            contributingWallets: participatingWallets.length,
            contributingWalletAddresses: participatingWallets.sort(),
            currentPrice: currentPrice.toFixed(4),
            takeProfitTargets: takeProfitLevels,
            stopLoss: stopLossLevel,
            clusterFills: bestCluster,
        };
        
        existingSignals.push(newSignal);
        await updateWalletCooldowns(participatingWallets, coin);
        await sendTelegramMessage(newSignal, settings);
        newSignalsWereAdded = true;
    }

    if (newSignalsWereAdded) {
        existingSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        await writeSignals(existingSignals);
        await log({ level: 'INFO', message: `New signal(s) were detected and saved.` });
    } else {
        await log({ level: 'INFO', message: "No new signals detected in this run." });
    }
}


export async function getSignals(): Promise<Signal[]> {
    return await readSignals();
}

export async function deleteSignal(signalId: string): Promise<void> {
    let signals = await readSignals();
    signals = signals.filter(s => s.id !== signalId);
    await writeSignals(signals);
}

export async function updateSignalPrices(): Promise<Signal[]> {
    const signals = await readSignals();
    const openSignals = signals.filter(s => s.status === 'Open');
    if (openSignals.length === 0) return signals;
    
    const uniqueCoins = Array.from(new Set(openSignals.map(s => s.pair)));
    
    const pricePromises = uniqueCoins.map(coin => 
        getMarkPrice(coin).then(price => ({ coin, price }))
    );
    const priceResults = await Promise.all(pricePromises);
    const prices = priceResults.reduce((acc, { coin, price }) => {
        acc[coin] = parseFloat(price);
        return acc;
    }, {} as Record<string, number>);

    let signalsWereUpdated = false;
    let walletsWereUpdated = false;
    const allWallets = await readWallets();

    const updatedSignals = signals.map(signal => {
        if (signal.status !== 'Open') {
            return signal;
        }

        const currentPrice = prices[signal.pair];
        if (currentPrice === undefined || isNaN(currentPrice) || currentPrice === 0) {
            return signal; // Don't update if price is invalid
        }

        signalsWereUpdated = true;
        const entryPrice = parseFloat(signal.entryPrice);
        const size = parseFloat(signal.size);
        const margin = parseFloat(signal.margin);
        const stopLoss = parseFloat(signal.stopLoss);
        const takeProfitTargets = signal.takeProfitTargets.map(parseFloat);
        
        let newStatus: Signal['status'] = signal.status;

        if (signal.type === 'LONG') {
            if (currentPrice <= stopLoss) {
                newStatus = 'SL';
            } else if (takeProfitTargets.some(tp => currentPrice >= tp)) {
                newStatus = 'TP';
            }
        } else { // SHORT
            if (currentPrice >= stopLoss) {
                newStatus = 'SL';
            } else if (takeProfitTargets.some(tp => currentPrice <= tp)) {
                newStatus = 'TP';
            }
        }

        const finalPrice = newStatus !== 'Open' ? currentPrice : currentPrice;
        const pnl = (finalPrice - entryPrice) * size * (signal.type === 'LONG' ? 1 : -1);
        const roi = margin > 0 ? (pnl / margin) * 100 : 0;
        
        if (newStatus !== 'Open') {
            walletsWereUpdated = true;
            
            const totalSignalSize = signal.clusterFills ? signal.clusterFills.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0) : parseFloat(signal.size);

            if (totalSignalSize > 0 && signal.clusterFills) {
                signal.clusterFills.forEach(fill => {
                    const walletAddress = fill.walletAddress;
                    const walletIndex = allWallets.findIndex(w => w.address === walletAddress);
                    
                    if (walletIndex > -1) {
                        const fillSize = Math.abs(parseFloat(fill.sz));
                        const walletProportion = fillSize / totalSignalSize;
                        const walletPnl = pnl * walletProportion;

                        allWallets[walletIndex].totalPnl += walletPnl;
                        allWallets[walletIndex].totalTrades += 1;
                        if (newStatus === 'TP') {
                            allWallets[walletIndex].winningTrades += 1;
                        }
                    }
                });
            } else {
                 // Fallback to equal distribution if clusterFills is not available
                const pnlPerWallet = pnl / signal.contributingWalletAddresses.length;
                signal.contributingWalletAddresses.forEach(address => {
                    const walletIndex = allWallets.findIndex(w => w.address === address);
                    if (walletIndex > -1) {
                        allWallets[walletIndex].totalPnl += pnlPerWallet;
                        allWallets[walletIndex].totalTrades += 1;
                        if (newStatus === 'TP') {
                            allWallets[walletIndex].winningTrades += 1;
                        }
                    }
                });
            }
        }
        
        return {
            ...signal,
            status: newStatus,
            currentPrice: currentPrice.toFixed(4),
            pnl: pnl.toFixed(2),
            roi: roi.toFixed(2),
        };
    });

    if (signalsWereUpdated) {
      await writeSignals(updatedSignals);
    }
    if (walletsWereUpdated) {
        await writeWallets(allWallets);
    }
    return updatedSignals;
}
