
'use server';
/**
 * @fileOverview A flow for finding wallets that hold a specific coin, including position details.
 * 
 * - findWalletsByCoin - A function that finds wallets by coin and returns detailed position info.
 * - FindWalletsByCoinInput - The input type for the findWalletsByCoin function.
 * - FindWalletsByCoinOutput - The return type for the findWalletsByCoin function.
 */

import { ai } from '@/ai/genkit';
import { getTrackedAddresses } from '@/app/(dashboard)/wallets/actions';
import { log } from '@/app/(dashboard)/logs/actions';
import { z } from 'zod';

const FindWalletsByCoinInputSchema = z.object({
  coin: z.string().describe('The coin symbol to search for (e.g., BTC, ETH).'),
});
export type FindWalletsByCoinInput = z.infer<typeof FindWalletsByCoinInputSchema>;


const WalletPositionSchema = z.object({
    address: z.string(),
    coin: z.string(),
    direction: z.enum(['LONG', 'SHORT']),
    positionSize: z.string(),
    entryPrice: z.string(),
    positionValue: z.string(),
    timestamp: z.string(),
});
export type WalletPosition = z.infer<typeof WalletPositionSchema>;

const FindWalletsByCoinOutputSchema = z.object({
    positions: z.array(WalletPositionSchema).describe('A list of wallets and their position details for the specified coin.'),
});
export type FindWalletsByCoinOutput = z.infer<typeof FindWalletsByCoinOutputSchema>;


async function getFirstFillTimestamp(address: string, coin: string): Promise<string> {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user: address }),
        });
        if (!response.ok) return new Date().toISOString();
        const fills = await response.json();

        // This is a simplified logic. A more robust solution would track position changes.
        const coinFills = fills.filter((f: any) => f.coin === coin).sort((a: any, b: any) => a.time - b.time);
        
        if (coinFills.length > 0) {
            // Find the most recent fill that likely opened the current position.
            // This is a heuristic and may not be perfect for complex trade histories.
            // We look backwards from the most recent trade.
            let positionSize = 0;
            let openTime = coinFills[coinFills.length - 1].time; // Default to last fill time
            for(let i = coinFills.length - 1; i >= 0; i--) {
                const fill = coinFills[i];
                const fillSize = parseFloat(fill.sz) * (fill.side === "B" ? 1 : -1);
                
                // If adding this fill's size flips the sign or goes from zero, it's an opening trade
                if (positionSize === 0 || (positionSize > 0 && positionSize + fillSize < 0) || (positionSize < 0 && positionSize + fillSize > 0)) {
                    openTime = fill.time;
                }
                positionSize += fillSize;

                // Stop if we've reconstructed the approximate current position
                // This is still a heuristic. For true accuracy, we'd need state.
            }
             return new Date(openTime).toISOString();
        }
        
        return new Date().toISOString();
        
    } catch (e) {
        return new Date().toISOString();
    }
}


const findWalletsByCoinFlow = ai.defineFlow(
  {
    name: 'findWalletsByCoinFlow',
    inputSchema: FindWalletsByCoinInputSchema,
    outputSchema: FindWalletsByCoinOutputSchema,
  },
  async (input) => {
    try {
      const trackedAddresses = await getTrackedAddresses();
      if (trackedAddresses.length === 0) {
        return { positions: [] };
      }

      const holdingPositions: WalletPosition[] = [];
      const coinUpperCase = input.coin.toUpperCase();
      
      const statePromises = trackedAddresses.map(address => 
        fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: address }),
        }).then(res => res.json().catch(() => null)).then(data => ({address, data}))
      );

      const results = await Promise.all(statePromises);

      const positionPromises = results.map(async ({ address, data }) => {
          if (!data) return null;
          
          const positions = data?.assetPositions ?? [];
          const targetPosition = positions.find((pos: any) => pos?.position?.coin?.toUpperCase() === coinUpperCase && parseFloat(pos?.position?.szi) !== 0);

          if (targetPosition) {
              const posDetails = targetPosition.position;
              const positionSize = parseFloat(posDetails.szi);
              const isLong = positionSize > 0;
              const entryPrice = parseFloat(posDetails.entryPx);
              const positionValue = Math.abs(positionSize) * entryPrice;

              const timestamp = await getFirstFillTimestamp(address, coinUpperCase);

              return {
                  address,
                  coin: posDetails.coin,
                  direction: isLong ? 'LONG' : 'SHORT',
                  positionSize: positionSize.toFixed(4),
                  entryPrice: entryPrice.toFixed(4),
                  positionValue: positionValue.toFixed(2),
                  timestamp,
              };
          }
          return null;
      });

      const resolvedPositions = await Promise.all(positionPromises);
      return { positions: resolvedPositions.filter((p): p is WalletPosition => p !== null) };

    } catch(e: any) {
        await log({ level: 'ERROR', message: `Failed to execute findWalletsByCoin flow for coin: ${input.coin}`, context: { error: e.message, stack: e.stack } });
        throw new Error("Failed to find wallets by coin. See logs for details.");
    }
  }
);

export async function findWalletsByCoin(input: FindWalletsByCoinInput): Promise<FindWalletsByCoinOutput> {
    return findWalletsByCoinFlow(input);
}
