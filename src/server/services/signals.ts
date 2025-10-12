import { fetchWithTimeout, RequestTimeoutError } from '@/utils/fetchWithTimeout';

import { readJsonFile, writeJsonFile } from '../storage/jsonStore';
import { getTrackedWalletsWithCooldown, readWallets, updateWalletCooldowns, writeWallets } from './wallets';
import { getSettings, Settings } from './settings';
import { log } from './logs';
import { writeWorkerState } from './workerState';

const HYPERLIQUID_MIN_REQUEST_INTERVAL_MS = Math.max(
  0,
  Number(process.env.HYPERLIQUID_MIN_REQUEST_INTERVAL_MS ?? 1_500)
);
const HYPERLIQUID_REQUEST_TIMEOUT_MS = Math.max(
  1_000,
  Number(process.env.HYPERLIQUID_REQUEST_TIMEOUT_MS ?? 15_000)
);
const USER_FILLS_MAX_RETRIES = Math.max(1, Number(process.env.USER_FILLS_MAX_RETRIES ?? 5));
const USER_FILLS_INITIAL_BACKOFF_MS = Math.max(
  250,
  Number(process.env.USER_FILLS_INITIAL_BACKOFF_MS ?? 1000)
);
const USER_FILLS_MAX_BACKOFF_MS = Math.max(
  USER_FILLS_INITIAL_BACKOFF_MS,
  Number(process.env.USER_FILLS_MAX_BACKOFF_MS ?? 60_000)
);
const HYPERLIQUID_TIMEOUT_PENALTY_MS = Math.max(
  HYPERLIQUID_MIN_REQUEST_INTERVAL_MS,
  HYPERLIQUID_REQUEST_TIMEOUT_MS,
  USER_FILLS_INITIAL_BACKOFF_MS
);
const DETECTION_RUN_TIME_LIMIT_MS = Math.max(
  30_000,
  Number(process.env.DETECTION_RUN_TIME_LIMIT_MS ?? 60_000)
);
const DETECTION_RUN_WARNING_THRESHOLD_MS = Math.max(
  15_000,
  Math.min(
    Number(process.env.DETECTION_RUN_WARNING_THRESHOLD_MS ?? 45_000),
    DETECTION_RUN_TIME_LIMIT_MS
  )
);
const TELEGRAM_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS ?? 15_000)
);

const LONG_WAIT_HEARTBEAT_INTERVAL_MS = Math.max(
  500,
  Number(process.env.LONG_WAIT_HEARTBEAT_INTERVAL_MS ?? 1_000)
);

type DetectionProgressPhase = 'fetch' | 'aggregate' | 'complete';

interface DetectSignalsProgress {
  processedWallets: number;
  totalWallets: number;
  durationMs: number;
  phase: DetectionProgressPhase;
  aborted: boolean;
}

interface DetectSignalsOptions {
  onProgress?: (progress: DetectSignalsProgress) => void | Promise<void>;
  deadlineMs?: number;
}

interface UpdateSignalPricesProgress {
  stage: 'start' | 'coin' | 'complete';
  durationMs: number;
  coin?: string;
  index?: number;
  total?: number;
  skipped?: boolean;
}

interface UpdateSignalPricesOptions {
  deadlineMs?: number;
  onProgress?: (progress: UpdateSignalPricesProgress) => void | Promise<void>;
}

const hyperliquidBaseUrl = 'https://api.hyperliquid.xyz/info';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(headerValue: string | null | undefined): number | null {
  if (!headerValue) {
    return null;
  }

  const numeric = Number(headerValue);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric * 1000;
  }

  const parsedDate = Date.parse(headerValue);
  if (Number.isFinite(parsedDate)) {
    const delay = parsedDate - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
}

async function waitWithActivity({
  durationMs,
  deadline,
  onActivity,
}: {
  durationMs: number;
  deadline?: number;
  onActivity?: () => void | Promise<void>;
}): Promise<boolean> {
  if (durationMs <= 0) {
    return Boolean(deadline && Date.now() >= deadline);
  }

  const waitUntil = Date.now() + durationMs;

  while (Date.now() < waitUntil) {
    if (deadline && Date.now() >= deadline) {
      return true;
    }

    if (onActivity) {
      await onActivity();
    }

    const remaining = waitUntil - Date.now();
    const sleepFor = Math.min(remaining, LONG_WAIT_HEARTBEAT_INTERVAL_MS);
    if (sleepFor > 0) {
      await sleep(sleepFor);
    }
  }

  if (onActivity) {
    await onActivity();
  }

  return Boolean(deadline && Date.now() >= deadline);
}

let hyperliquidQueue: Promise<void> = Promise.resolve();
let lastHyperliquidRequestTimestamp = 0;
let nextHyperliquidAvailableAt = 0;

function registerHyperliquidPenalty(delayMs: number) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  nextHyperliquidAvailableAt = Math.max(nextHyperliquidAvailableAt, Date.now() + delayMs);
}

async function scheduleHyperliquidRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = hyperliquidQueue.then(async () => {
    const now = Date.now();
    const earliestAllowed = Math.max(
      nextHyperliquidAvailableAt,
      lastHyperliquidRequestTimestamp + HYPERLIQUID_MIN_REQUEST_INTERVAL_MS
    );
    const wait = Math.max(0, earliestAllowed - now);
    if (wait > 0) {
      await sleep(wait);
    }

    try {
      return await task();
    } finally {
      lastHyperliquidRequestTimestamp = Date.now();
      nextHyperliquidAvailableAt = Math.max(
        nextHyperliquidAvailableAt,
        lastHyperliquidRequestTimestamp + HYPERLIQUID_MIN_REQUEST_INTERVAL_MS
      );
    }
  });

  hyperliquidQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

const SIGNALS_FILE_PATH = 'signals.json';

type SignalDirection = 'LONG' | 'SHORT';

function classifyFillForSignal(fill: any): { signalType: SignalDirection } | null {
  const tradeSize = Number.parseFloat(fill?.sz);
  if (!Number.isFinite(tradeSize) || tradeSize <= 0) {
    return null;
  }

  const normalizedDir = typeof fill?.dir === 'string' ? fill.dir.toLowerCase() : '';

  if (normalizedDir.includes('close')) {
    return null;
  }

  if (normalizedDir.includes('open')) {
    if (normalizedDir.includes('long')) {
      return { signalType: 'LONG' };
    }

    if (normalizedDir.includes('short')) {
      return { signalType: 'SHORT' };
    }
  }

  const startPosition = Number.parseFloat(fill?.startPosition);
  if (!Number.isFinite(startPosition)) {
    return null;
  }

  if (fill?.side === 'B' && startPosition >= 0) {
    return { signalType: 'LONG' };
  }

  if (fill?.side === 'A' && startPosition <= 0) {
    return { signalType: 'SHORT' };
  }

  return null;
}

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

const defaultSignals: Signal[] = [];

async function readSignals(): Promise<Signal[]> {
  return readJsonFile(SIGNALS_FILE_PATH, defaultSignals);
}

async function writeSignals(signals: Signal[]): Promise<void> {
  await writeJsonFile(SIGNALS_FILE_PATH, signals);
}

async function getMarkPrice(coin: string): Promise<string> {
  try {
    const { response, body } = await scheduleHyperliquidRequest(async () => {
      const response = await fetchWithTimeout(
        hyperliquidBaseUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'allMids' }),
        },
        HYPERLIQUID_REQUEST_TIMEOUT_MS
      );

      let body: any = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }

      return { response, body };
    });

    if (!response.ok || !body) {
      let retryAfterMs: number | null = null;
      if (response.status === 429) {
        retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        const penalty = retryAfterMs !== null
          ? Math.max(retryAfterMs, USER_FILLS_INITIAL_BACKOFF_MS)
          : USER_FILLS_INITIAL_BACKOFF_MS;
        registerHyperliquidPenalty(penalty);
      }
      await log({
        level: 'WARN',
        message: `Failed to fetch mark price for ${coin}`,
        context: {
          status: response.status,
          rateLimited: response.status === 429,
          retryAfterMs,
        },
      });
      return '0.00';
    }

    return body[coin] ?? '0.00';
  } catch (error: any) {
    if (error instanceof RequestTimeoutError) {
      registerHyperliquidPenalty(HYPERLIQUID_TIMEOUT_PENALTY_MS);
      await log({
        level: 'WARN',
        message: `Hyperliquid request timed out while fetching mark price for ${coin}`,
        context: { timeoutMs: HYPERLIQUID_REQUEST_TIMEOUT_MS },
      });
    } else {
      await log({ level: 'ERROR', message: `Failed to fetch mark price for ${coin}`, context: { error: error.message } });
    }
    return '0.00';
  }
}

interface GetUserFillsOptions {
  deadline?: number;
  onActivity?: () => void | Promise<void>;
}

interface UserFillsResult {
  fills: any[];
  aborted: boolean;
}

async function getUserFills(address: string, options: GetUserFillsOptions = {}): Promise<UserFillsResult> {
  let backoff = USER_FILLS_INITIAL_BACKOFF_MS;
  const { deadline, onActivity } = options;

  const hasExceededDeadline = () => (deadline ? Date.now() >= deadline : false);

  for (let attempt = 1; attempt <= USER_FILLS_MAX_RETRIES; attempt++) {
    if (hasExceededDeadline()) {
      return { fills: [], aborted: true };
    }

    try {
      if (onActivity) {
        await onActivity();
      }
      const { response, body } = await scheduleHyperliquidRequest(async () => {
        const response = await fetchWithTimeout(
          hyperliquidBaseUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user: address }),
          },
          HYPERLIQUID_REQUEST_TIMEOUT_MS
        );

        let body: any = null;
        try {
          body = await response.json();
        } catch (error) {
          body = null;
        }

        return { response, body };
      });

      if (response.ok) {
        if (Array.isArray(body)) {
          return { fills: body, aborted: false };
        }

        return { fills: body ?? [], aborted: false };
      }

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        const nextDelayMs = Math.max(backoff, retryAfterMs ?? 0);
        await log({
          level: 'WARN',
          message: `API call for userFills hit rate limit for ${address}`,
          context: {
            attempt,
            status: response.status,
            nextDelayMs,
            retryAfterMs: retryAfterMs ?? null,
          },
        });
        registerHyperliquidPenalty(nextDelayMs);

        if (attempt >= USER_FILLS_MAX_RETRIES) {
          break;
        }

        if (hasExceededDeadline()) {
          return { fills: [], aborted: true };
        }

        const waitTime = deadline
          ? Math.min(nextDelayMs, Math.max(0, deadline - Date.now()))
          : nextDelayMs;
        if (waitTime > 0) {
          const aborted = await waitWithActivity({
            durationMs: waitTime,
            deadline,
            onActivity,
          });
          if (aborted) {
            return { fills: [], aborted: true };
          }
        }
        backoff = Math.min(Math.max(backoff * 2, nextDelayMs), USER_FILLS_MAX_BACKOFF_MS);
        continue;
      }

      await log({
        level: 'WARN',
        message: `API call for userFills failed for ${address}`,
        context: { status: response.status, attempt },
      });
      return { fills: [], aborted: false };
    } catch (error: any) {
      const isTimeout = error instanceof RequestTimeoutError;
      const message = error?.message ?? 'Unknown error';

      if (attempt >= USER_FILLS_MAX_RETRIES) {
        await log({
          level: 'ERROR',
          message: `Failed to fetch user fills for ${address}`,
          context: { error: message, attempt, timeout: isTimeout },
        });
        break;
      }

      if (isTimeout) {
        await log({
          level: 'WARN',
          message: `Hyperliquid request timed out while fetching user fills for ${address}`,
          context: { attempt, timeoutMs: HYPERLIQUID_REQUEST_TIMEOUT_MS },
        });
        registerHyperliquidPenalty(HYPERLIQUID_TIMEOUT_PENALTY_MS);
      } else {
        await log({
          level: 'WARN',
          message: `Retrying user fills request for ${address}`,
          context: { error: message, attempt },
        });
      }

      if (hasExceededDeadline()) {
        return { fills: [], aborted: true };
      }

      const waitTime = deadline ? Math.min(backoff, Math.max(0, deadline - Date.now())) : backoff;
      if (waitTime > 0) {
        const aborted = await waitWithActivity({
          durationMs: waitTime,
          deadline,
          onActivity,
        });
        if (aborted) {
          return { fills: [], aborted: true };
        }
      }
      backoff = Math.min(backoff * 2, USER_FILLS_MAX_BACKOFF_MS);
    }
  }

  return { fills: [], aborted: false };
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

  const channels = telegramChannelIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  for (const channelId of channels) {
    try {
      const response = await fetchWithTimeout(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            text: message,
            parse_mode: 'Markdown',
          }),
        },
        TELEGRAM_REQUEST_TIMEOUT_MS
      );

      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (response.ok && result?.ok) {
        await log({ level: 'INFO', message: `Telegram message sent to channel ${channelId} for signal ${signal.id}` });
      } else {
        await log({
          level: 'ERROR',
          message: `Failed to send message to channel ${channelId} for signal ${signal.id}`,
          context: { status: response.status, result },
        });
      }
    } catch (error: any) {
      const isTimeout = error instanceof RequestTimeoutError;
      await log({
        level: 'ERROR',
        message: `Error sending message to channel ${channelId}`,
        context: { error: error.message, timeout: isTimeout, timeoutMs: TELEGRAM_REQUEST_TIMEOUT_MS },
      });
    }
  }
}

export async function detectAndSaveSignals(options: DetectSignalsOptions = {}): Promise<void> {
  const walletsWithCooldown = await getTrackedWalletsWithCooldown();
  const trackedAddresses = walletsWithCooldown.map((wallet) => wallet.address);
  const settings = await getSettings();
  const { minWalletCount, timeWindow, minVolume, defaultStopLoss, takeProfitTargets: tpTargetsSetting } = settings;

  if (trackedAddresses.length === 0 || minWalletCount <= 0 || timeWindow <= 0) {
    await log({ level: 'INFO', message: 'Signal detection skipped: Insufficient configuration or no tracked wallets.' });
    await writeWorkerState({
      nextWalletIndex: 0,
      lastDetectionRunAt: new Date().toISOString(),
      lastDetectionRunDurationMs: 0,
    });
    return;
  }

  const detectionStartedAt = Date.now();
  const overallDeadlineCandidate = options.deadlineMs ?? Number.POSITIVE_INFINITY;
  const fetchDeadlineCandidate = Math.min(
    overallDeadlineCandidate,
    detectionStartedAt + DETECTION_RUN_TIME_LIMIT_MS
  );
  const fetchDeadline = Number.isFinite(fetchDeadlineCandidate)
    ? fetchDeadlineCandidate
    : undefined;
  const overallDeadline = Number.isFinite(overallDeadlineCandidate)
    ? overallDeadlineCandidate
    : undefined;
  const addressesThisRun = [...trackedAddresses];
  const runtimeBudgetMs =
    fetchDeadline !== undefined ? Math.max(fetchDeadline - detectionStartedAt, 0) : null;

  const fillsByWallet: { address: string; fills: any[] }[] = [];
  let detectionAborted = false;

  const elapsed = () => Date.now() - detectionStartedAt;

  const reportProgress = async (phase: DetectionProgressPhase, aborted: boolean) => {
    if (!options.onProgress) {
      return;
    }

    await options.onProgress({
      processedWallets: fillsByWallet.length,
      totalWallets: addressesThisRun.length,
      durationMs: elapsed(),
      phase,
      aborted,
    });
  };

  const fetchDeadlineExceeded = () => {
    if (!fetchDeadline) {
      return false;
    }

    if (Date.now() >= fetchDeadline) {
      detectionAborted = true;
      return true;
    }

    return false;
  };

  const overallDeadlineExceeded = () => {
    if (!overallDeadline) {
      return false;
    }

    if (Date.now() >= overallDeadline) {
      detectionAborted = true;
      return true;
    }

    return false;
  };

  const pulseFetchActivity = async () => {
    await reportProgress('fetch', detectionAborted);
  };

  await reportProgress('fetch', false);

  for (const address of addressesThisRun) {
    if (fetchDeadlineExceeded()) {
      detectionAborted = true;
      break;
    }

    const result = await getUserFills(address, { deadline: fetchDeadline, onActivity: pulseFetchActivity });

    if (result.aborted) {
      detectionAborted = true;
      break;
    }

    fillsByWallet.push({ address, fills: result.fills || [] });
    await reportProgress('fetch', detectionAborted);

    if (overallDeadlineExceeded()) {
      break;
    }
  }

  const detectionDurationMs = Date.now() - detectionStartedAt;
  await writeWorkerState({
    lastDetectionRunAt: new Date().toISOString(),
    lastDetectionRunDurationMs: detectionDurationMs,
    nextWalletIndex: 0,
  });

  await reportProgress('aggregate', detectionAborted);

  if (detectionAborted) {
    await log({
      level: 'WARN',
      message: 'Signal detection aborted early due to runtime limits.',
      context: {
        processedWallets: fillsByWallet.length,
        totalWallets: trackedAddresses.length,
        durationMs: detectionDurationMs,
        detectionDeadlineMs: fetchDeadline ?? null,
        automationDeadlineMs: overallDeadline ?? null,
        runtimeBudgetMs,
      },
    });
  } else if (detectionDurationMs >= DETECTION_RUN_WARNING_THRESHOLD_MS) {
    await log({
      level: 'WARN',
      message: 'Signal detection run approached the runtime warning threshold.',
      context: {
        processedWallets: fillsByWallet.length,
        totalWallets: trackedAddresses.length,
        durationMs: detectionDurationMs,
        warningThresholdMs: DETECTION_RUN_WARNING_THRESHOLD_MS,
        runtimeBudgetMs,
      },
    });
  } else if (fillsByWallet.length > 0) {
    await log({
      level: 'INFO',
      message: 'Signal detection scanned all wallets within limits.',
      context: {
        processedWallets: fillsByWallet.length,
        totalWallets: trackedAddresses.length,
        durationMs: detectionDurationMs,
        runtimeBudgetMs,
      },
    });
  }

  const timeWindowMs = timeWindow * 60 * 1000;
  const cooldownMs = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const walletDataMap = new Map(walletsWithCooldown.map((wallet) => [wallet.address.toLowerCase(), wallet]));

  const recentOpeningFills: any[] = [];
  for (const { address, fills } of fillsByWallet) {
    if (overallDeadlineExceeded()) {
      break;
    }

    for (const fill of fills) {
      if (overallDeadlineExceeded()) {
        break;
      }

      const isRecent = now - fill.time < timeWindowMs;
      const classification = classifyFillForSignal(fill);

      if (isRecent && classification) {
        const wallet = walletDataMap.get(address.toLowerCase());
        const cooldownTimestamp = wallet?.cooldowns?.[fill.coin];
        const isOnCooldown =
          cooldownTimestamp && now - new Date(cooldownTimestamp).getTime() < cooldownMs;

        if (!isOnCooldown) {
          recentOpeningFills.push({ ...fill, walletAddress: address, signalType: classification.signalType });
        }
      }
    }

    if (detectionAborted) {
      break;
    }
  }

  await reportProgress('aggregate', detectionAborted);

  if (recentOpeningFills.length === 0) {
    await log({ level: 'INFO', message: 'No recent opening fills meeting criteria found.' });
    await reportProgress('complete', detectionAborted);
    return;
  }

  const fillsByPosition = new Map<string, { type: SignalDirection; fills: any[] }>();
  for (const fill of recentOpeningFills) {
    if (overallDeadlineExceeded()) {
      break;
    }

    const type: SignalDirection | undefined = fill.signalType;
    if (!type) {
      continue;
    }

    const key = `${fill.coin}-${type}`;
    const existing = fillsByPosition.get(key);
    if (existing) {
      existing.fills.push(fill);
    } else {
      fillsByPosition.set(key, { type, fills: [fill] });
    }
  }

  const existingSignals = await readSignals();
  let newSignalsWereAdded = false;

  for (const { type: signalType, fills: positionFills } of fillsByPosition.values()) {
    if (overallDeadlineExceeded()) {
      break;
    }

    await reportProgress('aggregate', detectionAborted);
    const sortedFills = positionFills.sort((a, b) => a.time - b.time);
    let bestCluster: any[] | null = null;

    const walletCounts = new Map<string, number>();
    let startIndex = 0;
    let bestUniqueWalletCount = 0;

    for (let endIndex = 0; endIndex < sortedFills.length; endIndex++) {
      if (overallDeadlineExceeded()) {
        detectionAborted = true;
        break;
      }

      const endFill = sortedFills[endIndex];
      const endWallet = String(endFill.walletAddress ?? '__unknown__');
      walletCounts.set(endWallet, (walletCounts.get(endWallet) ?? 0) + 1);

      while (
        startIndex <= endIndex &&
        sortedFills[endIndex].time - sortedFills[startIndex].time >= timeWindowMs
      ) {
        const startFill = sortedFills[startIndex];
        const startWallet = String(startFill.walletAddress ?? '__unknown__');
        const remaining = (walletCounts.get(startWallet) ?? 0) - 1;
        if (remaining > 0) {
          walletCounts.set(startWallet, remaining);
        } else {
          walletCounts.delete(startWallet);
        }
        startIndex += 1;

        if (overallDeadlineExceeded()) {
          detectionAborted = true;
          break;
        }
      }

      if (detectionAborted) {
        break;
      }

      const uniqueWalletCount = walletCounts.size;
      if (uniqueWalletCount >= minWalletCount && uniqueWalletCount > bestUniqueWalletCount) {
        bestUniqueWalletCount = uniqueWalletCount;
        bestCluster = sortedFills.slice(startIndex, endIndex + 1);
      }
    }

    if (detectionAborted) {
      break;
    }

    if (!bestCluster) {
      continue;
    }

    const totalVolume = bestCluster.reduce(
      (sum, fill) => sum + parseFloat(fill.px) * Math.abs(parseFloat(fill.sz)),
      0
    );
    if (totalVolume < minVolume) {
      continue;
    }

    if (overallDeadlineExceeded()) {
      detectionAborted = true;
      break;
    }

    const { coin } = bestCluster[0];
    const type = signalType;
    const signalTimestamp = bestCluster.reduce((latest, fill) => Math.max(latest, fill.time), 0);
    const signalId = `${coin}-${type}-${signalTimestamp}`;

    if (existingSignals.some((signal) => signal.id === signalId)) {
      continue;
    }

    if (overallDeadlineExceeded()) {
      detectionAborted = true;
      break;
    }

    const participatingWallets = Array.from(new Set(bestCluster.map((fill) => fill.walletAddress)));

    const totalSize = bestCluster.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0);
    const totalCost = bestCluster.reduce((acc, fill) => acc + parseFloat(fill.px) * Math.abs(parseFloat(fill.sz)), 0);
    const avgEntryPrice = totalSize > 0 ? totalCost / totalSize : 0;

    if (overallDeadlineExceeded()) {
      detectionAborted = true;
      break;
    }

    const currentPriceStr = await getMarkPrice(coin);
    const currentPrice = parseFloat(currentPriceStr);
    const pnl =
      totalSize > 0 ? (currentPrice - avgEntryPrice) * totalSize * (type === 'LONG' ? 1 : -1) : 0;

    const { totalMargin, totalLeverageValue, leverageCount } = bestCluster.reduce(
      (acc, fill) => {
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

    const avgLeverage = leverageCount > 0 ? totalLeverageValue / leverageCount : 10;
    const roi = totalMargin > 0 ? (pnl / totalMargin) * 100 : 0;

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
      margin: totalMargin.toFixed(2),
      size: totalSize.toFixed(4),
      contributingWallets: participatingWallets.length,
      contributingWalletAddresses: participatingWallets.sort(),
      currentPrice: currentPrice.toFixed(4),
      takeProfitTargets: takeProfitLevels,
      stopLoss: stopLossLevel,
      clusterFills: bestCluster,
    };

    if (overallDeadlineExceeded()) {
      detectionAborted = true;
      break;
    }

    existingSignals.push(newSignal);
    await updateWalletCooldowns(participatingWallets, coin);
    if (!overallDeadlineExceeded()) {
      await sendTelegramMessage(newSignal, settings);
    }
    newSignalsWereAdded = true;
  }

  if (newSignalsWereAdded) {
    existingSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    await writeSignals(existingSignals);
    await log({ level: 'INFO', message: 'New signal(s) were detected and saved.' });
  } else {
    await log({ level: 'INFO', message: 'No new signals detected in this run.' });
  }

  await reportProgress('complete', detectionAborted);
}

export async function getSignals(): Promise<Signal[]> {
  const signals = await readSignals();
  return [...signals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function deleteSignal(signalId: string): Promise<void> {
  const signals = await readSignals();
  const updated = signals.filter((signal) => signal.id !== signalId);
  await writeSignals(updated);
}

export async function updateSignalPrices(options: UpdateSignalPricesOptions = {}): Promise<Signal[]> {
  const { deadlineMs, onProgress } = options;
  const startedAt = Date.now();
  const deadline = typeof deadlineMs === 'number' && Number.isFinite(deadlineMs) ? deadlineMs : undefined;

  const elapsed = () => Date.now() - startedAt;
  const reportProgress = async (progress: Omit<UpdateSignalPricesProgress, 'durationMs'>) => {
    if (!onProgress) {
      return;
    }

    await onProgress({ ...progress, durationMs: elapsed() });
  };

  const hasExceededDeadline = () => (deadline ? Date.now() >= deadline : false);

  const signals = await readSignals();
  const openSignals = signals.filter((signal) => signal.status === 'Open');
  const uniqueCoins = Array.from(new Set(openSignals.map((signal) => signal.pair)));

  await reportProgress({ stage: 'start', total: uniqueCoins.length });

  if (openSignals.length === 0) {
    await reportProgress({ stage: 'complete', skipped: true, total: 0 });
    return signals;
  }

  const prices: Record<string, number> = {};
  for (let index = 0; index < uniqueCoins.length; index++) {
    if (hasExceededDeadline()) {
      await reportProgress({ stage: 'complete', skipped: true, total: uniqueCoins.length });
      return signals;
    }

    const coin = uniqueCoins[index];
    await reportProgress({ stage: 'coin', coin, index, total: uniqueCoins.length });

    const price = await getMarkPrice(coin);
    const parsedPrice = parseFloat(price);
    if (!Number.isNaN(parsedPrice)) {
      prices[coin] = parsedPrice;
    }
  }

  let signalsWereUpdated = false;
  let walletsWereUpdated = false;
  const wallets = await readWallets();

  const updatedSignals = signals.map((signal) => {
    if (signal.status !== 'Open') {
      return signal;
    }

    const currentPrice = prices[signal.pair];
    if (currentPrice === undefined || Number.isNaN(currentPrice) || currentPrice === 0) {
      return signal;
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

    const finalPrice = currentPrice;
    const pnl = (finalPrice - entryPrice) * size * (signal.type === 'LONG' ? 1 : -1);
    const roi = margin > 0 ? (pnl / margin) * 100 : 0;

    if (newStatus !== 'Open') {
      walletsWereUpdated = true;
      const totalSignalSize = signal.clusterFills
        ? signal.clusterFills.reduce((acc, fill) => acc + Math.abs(parseFloat(fill.sz)), 0)
        : size;

      if (totalSignalSize > 0 && signal.clusterFills) {
        signal.clusterFills.forEach((fill) => {
          const walletIndex = wallets.findIndex((wallet) => wallet.address === fill.walletAddress);
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

  await reportProgress({ stage: 'complete', skipped: false, total: uniqueCoins.length });

  return updatedSignals;
}
