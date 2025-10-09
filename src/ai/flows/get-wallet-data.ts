
'use server';
/**
 * @fileOverview A flow for fetching wallet data from the Hyperliquid API.
 * 
 * - getWalletData - A function that fetches wallet data.
 * - GetWalletDataInput - The input type for the getWalletData function.
 * - GetWalletDataOutput - The return type for the getWalletData function.
 */

import { ai } from '@/ai/genkit';
import { log } from '@/app/(dashboard)/logs/actions';
import { fetchWithTimeout, RequestTimeoutError } from '@/utils/fetchWithTimeout';
import { z } from 'zod';

const GetWalletDataInputSchema = z.object({
  address: z.string().describe('The wallet address.'),
});
export type GetWalletDataInput = z.infer<typeof GetWalletDataInputSchema>;

const GetWalletDataOutputSchema = z.object({
  pnl: z.string(),
  roi: z.string(),
  positions: z.array(z.any()),
});
export type GetWalletDataOutput = z.infer<typeof GetWalletDataOutputSchema>;

const getWalletDataFlow = ai.defineFlow(
  {
    name: 'getWalletDataFlow',
    inputSchema: GetWalletDataInputSchema,
    outputSchema: GetWalletDataOutputSchema,
  },
  async (input) => {
    const timeoutMs = Math.max(5_000, Number(process.env.HYPERLIQUID_FLOW_TIMEOUT_MS ?? 15_000));
    try {
      const response = await fetchWithTimeout(
        'https://api.hyperliquid.xyz/info',
        {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              type: 'clearinghouseState',
              user: input.address,
          }),
        },
        timeoutMs
      );

      if (!response.ok) {
          const errorBody = await response.text();
          await log({ level: 'ERROR', message: `Explorer API call failed for ${input.address}`, context: { status: response.status, body: errorBody } });
          throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = (await response.json().catch(() => null)) as Record<string, any> | null;

      const positions: any[] = Array.isArray(data?.assetPositions) ? (data!.assetPositions as any[]) : [];
      
      let totalPnl = 0;
      let totalMargin = 0;

      if (positions.length > 0) {
        for (const pos of positions) {
          const pnl = parseFloat(pos.unrealizedPnl);
          if (!isNaN(pnl)) {
            totalPnl += pnl;
          }
          
          const positionDetails = pos.position;
          const positionSize = Math.abs(parseFloat(positionDetails.szi));
          const entryPrice = parseFloat(positionDetails.entryPx);
          const leverage = parseFloat(positionDetails.leverage.value);

          if (!isNaN(positionSize) && !isNaN(entryPrice) && !isNaN(leverage) && leverage > 0) {
            totalMargin += (positionSize * entryPrice) / leverage;
          }
        }
      }
      
      const totalRoi = totalMargin > 0 ? (totalPnl / totalMargin) * 100 : 0;

      return {
          pnl: totalPnl.toFixed(2),
          roi: totalRoi.toFixed(2),
          positions,
      };
    } catch(e: any) {
        const error = e as Error;
        const timeout = error instanceof RequestTimeoutError;
        const message = timeout
          ? `Hyperliquid request timed out after ${timeoutMs}ms`
          : error.message;
        await log({
          level: 'ERROR',
          message: `Failed to fetch wallet data for ${input.address}`,
          context: { error: message, stack: error.stack, timeoutMs: timeout ? timeoutMs : undefined },
        });
        throw new Error("Failed to fetch wallet data from Hyperliquid API. See logs for details.");
    }
  }
);


export async function getWalletData(input: GetWalletDataInput): Promise<GetWalletDataOutput> {
    return getWalletDataFlow(input);
}
