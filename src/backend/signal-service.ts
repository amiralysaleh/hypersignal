import * as path from 'path';
import { readJsonFile, writeJsonFile } from './storage';
import { Signal } from '@/types/signal';
import { getTrackedWalletsWithCooldown, readWallets, updateWalletCooldowns, writeWallets } from './wallet-service';
import { getSettings } from './settings-service';
import { appendLog } from './log-service';
import { Settings } from '@/types/settings';

const SIGNALS_FILE_PATH = path.resolve(process.cwd(), 'signals.json');

async function readSignals(): Promise<Signal[]> {
  return readJsonFile<Signal[]>(SIGNALS_FILE_PATH, []);
}

async function writeSignals(signals: Signal[]): Promise<void> {
  await writeJsonFile(SIGNALS_FILE_PATH, signals);
}

async function getMarkPrice(coin: string): Promise<number> {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });
    if (!response.ok) {
      await appendLog({ level: 'WARN', message: `Failed to fetch mark price for ${coin}`, context: { status: response.status } });
      return 0;
    }
    const data = await response.json();
    return parseFloat(data[coin] ?? '0');
  } catch (error: any) {
    await appendLog({ level: 'ERROR', message: `Failed to fetch mark price for ${coin}`, context: { error: error.message } });
    return 0;
  }
}

async function getUserFills(address: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFills', user: address }),
    });
    if (!response.ok) {
      await appendLog({ level: 'WARN', message: `API call for userFills failed for ${address}`, context: { status: response.status } });
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    await appendLog({ level: 'ERROR', message: `Failed to fetch user fills for ${address}`, context: { error: error.message } });
    return [];
  }
}

async function sendTelegramMessage(signal: Signal, settings: Settings) {
  const { telegramBotToken, telegramChannelIds } = settings;
  if (!telegramBotToken || !telegramChannelIds) {
    await appendLog({ level: 'INFO', message: `Telegram settings not configured. Skipping notification for signal ${signal.id}.` });
    return;
  }

  const direction = signal.type === 'LONG' ? '⬆️ LONG' : '⬇️ SHORT';
  const message = `*New Signal Detected!*\n-----------------------------------\n*${signal.pair}-USDC*\n*Direction:* ${direction}\n-----------------------------------\n*Entry Price:* ${signal.entryPrice}\n*Total Margin:* $${signal.margin}\n*Avg. Leverage:* ${signal.leverage}x\n*Consensus:* ${signal.contributingWallets} wallets\n-----------------------------------\n*Stop Loss:* ${signal.stopLoss}\n*Take Profit Targets:*\n${signal.takeProfitTargets.map((tp, i) => `TP ${i + 1}: ${tp}`).join('\n')}\n-----------------------------------\n[View Dashboard](https://your-dashboard-url.com/signals) | [View Chart](https://www.tradingview.com/symbols/${signal.pair}USDC/)`;

  const channels = telegramChannelIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  for (const channelId of channels) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channelId, text: message, parse_mode: 'Markdown' }),
      });
      const result = await response.json();
      if (!result.ok) {
        await appendLog({ level: 'ERROR', message: `Failed to send message to channel ${channelId} for signal ${signal.id}`, context: result });
      } else {
        await appendLog({ level: 'INFO', message: `Telegram message sent to channel ${channelId} for signal ${signal.id}` });
      }
    } catch (error: any) {
      await appendLog({ level: 'ERROR', message: `Error sending message to channel ${channelId}`, context: { error: error.message } });
    }
  }
}

export async function detectAndSaveSignals(): Promise<boolean> {
  const walletsWithCooldown = await getTrackedWalletsWithCooldown();
  const trackedAddresses = walletsWithCooldown.map((wallet) => wallet.address);
  const settings = await getSettings();
  const { minWalletCount, timeWindow, minVolume, defaultStopLoss, takeProfitTargets: tpTargetsSetting } = settings;

  if (trackedAddresses.length === 0 || minWalletCount <= 0 || timeWindow <= 0) {
    await appendLog({ level: 'INFO', message: 'Signal detection skipped: Insufficient configuration or no tracked wallets.' });
    return false;
  }

  const allFillsPromises = trackedAddresses.map((address) =>
    getUserFills(address).then((fills) => ({ address, fills: fills || [] }))
  );
  const allFillsResults = await Promise.all(allFillsPromises);

  const timeWindowMs = timeWindow * 60 * 1000;
  const cooldownMs = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const walletDataMap = new Map(walletsWithCooldown.map((wallet) => [wallet.address.toLowerCase(), wallet]));

  const recentOpeningFills: any[] = [];

  allFillsResults.forEach(({ address, fills }) => {
    fills.forEach((fill) => {
      const isRecent = now - fill.time < timeWindowMs;
      const startPosition = parseFloat(fill.startPosition);
      const tradeSize = parseFloat(fill.sz);
      const isOpeningTrade =
        (fill.side === 'B' && startPosition >= 0 && tradeSize > 0) ||
        (fill.side === 'A' && startPosition <= 0 && tradeSize > 0);

      if (!isRecent || !isOpeningTrade) {
        return;
      }

      const wallet = walletDataMap.get(address.toLowerCase());
      const cooldownTimestamp = wallet?.cooldowns?.[fill.coin];
      const isOnCooldown =
        cooldownTimestamp && now - new Date(cooldownTimestamp).getTime() < cooldownMs;

      if (!isOnCooldown) {
        recentOpeningFills.push({ ...fill, walletAddress: address });
      }
    });
  });

  if (recentOpeningFills.length === 0) {
    await appendLog({ level: 'INFO', message: 'No recent opening fills meeting criteria found.' });
    return false;
  }

  const fillsByPosition: Record<string, any[]> = {};
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

  for (const key of Object.keys(fillsByPosition)) {
    const positionFills = fillsByPosition[key].sort((a, b) => a.time - b.time);
    let bestCluster: any[] | null = null;

    for (let i = 0; i < positionFills.length; i++) {
      const anchorFill = positionFills[i];
      const windowEndTime = anchorFill.time + timeWindowMs;
      const currentWindowFills = positionFills.filter((fill) => fill.time >= anchorFill.time && fill.time < windowEndTime);
      const uniqueWalletsInWindow = new Set(currentWindowFills.map((fill) => fill.walletAddress));
      if (uniqueWalletsInWindow.size >= minWalletCount) {
        if (!bestCluster || uniqueWalletsInWindow.size > new Set(bestCluster.map((fill) => fill.walletAddress)).size) {
          bestCluster = currentWindowFills;
        }
      }
    }

    if (!bestCluster) {
      continue;
    }

    const totalVolume = bestCluster.reduce((sum, fill) => sum + parseFloat(fill.px) * Math.abs(parseFloat(fill.sz)), 0);
    if (totalVolume < minVolume) {
      continue;
    }

    const { coin, side } = bestCluster[0];
    const type = side === 'B' ? 'LONG' : 'SHORT';
    const signalTimestamp = bestCluster.reduce((latest, fill) => Math.max(latest, fill.time), 0);
    const signalId = `${coin}-${type}-${signalTimestamp}`;

    if (existingSignals.some((signal) => signal.id === signalId)) {
      continue;
    }

    const participatingWallets = Array.from(new Set(bestCluster.map((fill) => fill.walletAddress)));
    const totalSize = bestCluster.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0);
    const totalCost = bestCluster.reduce((acc, fill) => acc + parseFloat(fill.px) * Math.abs(parseFloat(fill.sz)), 0);
    const avgEntryPrice = totalSize > 0 ? totalCost / totalSize : 0;

    const currentPrice = await getMarkPrice(coin);
    const pnl = totalSize > 0 ? (currentPrice - avgEntryPrice) * totalSize * (type === 'LONG' ? 1 : -1) : 0;

    const leverageStats = bestCluster.reduce(
      (acc: { totalMargin: number; totalLeverageValue: number; leverageCount: number }, fill: any) => {
        const leverage = fill.leverage?.value ? parseFloat(fill.leverage.value) : 10;
        const fillSize = Math.abs(parseFloat(fill.sz));
        const fillPrice = parseFloat(fill.px);
        acc.totalMargin += (fillPrice * fillSize) / leverage;
        acc.totalLeverageValue += leverage;
        acc.leverageCount += 1;
        return acc;
      },
      { totalMargin: 0, totalLeverageValue: 0, leverageCount: 0 }
    );

    const avgLeverage = leverageStats.leverageCount > 0 ? leverageStats.totalLeverageValue / leverageStats.leverageCount : 10;
    const roi = leverageStats.totalMargin > 0 ? (pnl / leverageStats.totalMargin) * 100 : 0;

    const tpTargets = tpTargetsSetting
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean);

    const takeProfitLevels = tpTargets.map((target) => {
      const multiplier = parseFloat(target) / 100;
      return type === 'LONG'
        ? (avgEntryPrice * (1 + multiplier)).toFixed(4)
        : (avgEntryPrice * (1 - multiplier)).toFixed(4);
    });

    const stopLossLevel =
      type === 'LONG'
        ? (avgEntryPrice * (1 + defaultStopLoss / 100)).toFixed(4)
        : (avgEntryPrice * (1 - defaultStopLoss / 100)).toFixed(4);

    const newSignal: Signal = {
      id: signalId,
      pair: coin,
      type,
      entryPrice: avgEntryPrice.toFixed(4),
      pnl: pnl.toFixed(2),
      roi: roi.toFixed(2),
      status: 'Open',
      timestamp: new Date(signalTimestamp).toISOString(),
      leverage: avgLeverage.toFixed(2),
      liquidationPrice: 'N/A',
      margin: leverageStats.totalMargin.toFixed(2),
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
    await appendLog({ level: 'INFO', message: 'New signal(s) were detected and saved.' });
  } else {
    await appendLog({ level: 'INFO', message: 'No new signals detected in this run.' });
  }

  return newSignalsWereAdded;
}

export async function getSignals(): Promise<Signal[]> {
  return readSignals();
}

export async function deleteSignal(signalId: string): Promise<void> {
  const signals = await readSignals();
  const filtered = signals.filter((signal) => signal.id !== signalId);
  if (filtered.length === signals.length) {
    throw new Error('Signal not found.');
  }
  await writeSignals(filtered);
}

export async function updateSignalPrices(): Promise<Signal[]> {
  const signals = await readSignals();
  const openSignals = signals.filter((signal) => signal.status === 'Open');
  if (openSignals.length === 0) {
    return signals;
  }

  const uniqueCoins = Array.from(new Set(openSignals.map((signal) => signal.pair)));
  const priceResults = await Promise.all(uniqueCoins.map((coin) => getMarkPrice(coin).then((price) => ({ coin, price }))));
  const priceMap = priceResults.reduce<Record<string, number>>((acc, { coin, price }) => {
    if (!Number.isNaN(price) && price > 0) {
      acc[coin] = price;
    }
    return acc;
  }, {});

  if (Object.keys(priceMap).length === 0) {
    return signals;
  }

  let signalsWereUpdated = false;
  let walletsWereUpdated = false;
  const wallets = await readWallets();

  const updatedSignals = signals.map((signal) => {
    if (signal.status !== 'Open') {
      return signal;
    }

    const currentPrice = priceMap[signal.pair];
    if (currentPrice === undefined) {
      return signal;
    }

    signalsWereUpdated = true;
    const entryPrice = parseFloat(signal.entryPrice);
    const size = parseFloat(signal.size);
    const margin = parseFloat(signal.margin);
    const stopLoss = parseFloat(signal.stopLoss);
    const takeProfitTargets = signal.takeProfitTargets.map((tp) => parseFloat(tp));

    let newStatus: Signal['status'] = signal.status;
    if (signal.type === 'LONG') {
      if (currentPrice <= stopLoss) {
        newStatus = 'SL';
      } else if (takeProfitTargets.some((tp) => currentPrice >= tp)) {
        newStatus = 'TP';
      }
    } else {
      if (currentPrice >= stopLoss) {
        newStatus = 'SL';
      } else if (takeProfitTargets.some((tp) => currentPrice <= tp)) {
        newStatus = 'TP';
      }
    }

    const pnl = (currentPrice - entryPrice) * size * (signal.type === 'LONG' ? 1 : -1);
    const roi = margin > 0 ? (pnl / margin) * 100 : 0;

    if (newStatus !== 'Open') {
      walletsWereUpdated = true;
      const totalSignalSize = signal.clusterFills
        ? signal.clusterFills.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0)
        : parseFloat(signal.size);

      if (totalSignalSize > 0 && signal.clusterFills) {
        signal.clusterFills.forEach((fill) => {
          const walletAddress = fill.walletAddress;
          const walletIndex = wallets.findIndex((wallet) => wallet.address === walletAddress);
          if (walletIndex > -1) {
            const fillSize = Math.abs(parseFloat(fill.sz));
            const walletProportion = fillSize / totalSignalSize;
            const walletPnl = pnl * walletProportion;
            wallets[walletIndex].totalPnl += walletPnl;
            wallets[walletIndex].totalTrades += 1;
            if (newStatus === 'TP') {
              wallets[walletIndex].winningTrades += 1;
            }
          }
        });
      } else {
        const pnlPerWallet = pnl / signal.contributingWalletAddresses.length;
        signal.contributingWalletAddresses.forEach((address) => {
          const walletIndex = wallets.findIndex((wallet) => wallet.address === address);
          if (walletIndex > -1) {
            wallets[walletIndex].totalPnl += pnlPerWallet;
            wallets[walletIndex].totalTrades += 1;
            if (newStatus === 'TP') {
              wallets[walletIndex].winningTrades += 1;
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
    await writeWallets(wallets);
  }

  return updatedSignals;
}
