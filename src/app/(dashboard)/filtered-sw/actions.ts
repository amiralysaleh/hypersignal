
'use server';

import { ai } from '@/ai/genkit';
import { getSignals, Signal } from '@/app/(dashboard)/signals/actions';
import { z } from 'zod';
import { log } from '../logs/actions';

// == Predict Signal Success Schemas and Flow ==

const SuccessPredictionInputSchema = z.object({});
export type SuccessPredictionInput = z.infer<typeof SuccessPredictionInputSchema>;

const SuccessPredictionOutputSchema = z.object({
  successProbability: z.number().describe('A probability score from 0 to 100 representing the likelihood of the next signal hitting Take Profit.'),
});
export type SuccessPredictionOutput = z.infer<typeof SuccessPredictionOutputSchema>;

const predictSignalSuccessFlow = ai.defineFlow(
  {
    name: 'predictSignalSuccessFlow',
    inputSchema: SuccessPredictionInputSchema,
    outputSchema: SuccessPredictionOutputSchema,
  },
  async () => {
    try {
      const signals = await getSignals();
      const recentSignals = signals.slice(0, 50); // Use last 50 signals for context

      if (recentSignals.length < 10) {
        return { successProbability: 50.0 }; // Default if not enough data
      }

      const prompt = `
        Analyze the following historical trading signal data. Based on this data, predict the success probability (as a percentage) of the NEXT signal.

        Consider the following factors in your analysis:
        1.  Recent Win/Loss Streak: Are there patterns of consecutive Take Profit (TP) or Stop Loss (SL) signals?
        2.  Overall Win Rate: What is the ratio of TP to SL in the recent data?
        3.  Market Conditions Implied by Pairs: Note the coins being traded (e.g., BTC, ETH, SOL are majors; others might be more volatile).
        4.  Signal Type Distribution: Is there a recent bias towards LONG or SHORT signals?

        Historical Data:
        ${recentSignals.map(s => ` - Pair: ${s.pair}, Type: ${s.type}, Status: ${s.status}, PnL: ${s.pnl}`).join('\n')}

        Based on your analysis of these factors, provide a single probability score from 0 to 100 for the next signal's success.
      `;

      const llmResponse = await ai.generate({
        prompt: prompt,
        output: {
          schema: SuccessPredictionOutputSchema
        },
        config: { temperature: 0.3 }
      });
      
      const output = llmResponse.output();
      if (!output) {
          throw new Error("LLM failed to provide a prediction.");
      }

      return output;
    } catch(e: any) {
      await log({ level: 'ERROR', message: 'Failed to execute predictSignalSuccess flow', context: { error: e.message } });
      return { successProbability: 50.0 };
    }
  }
);

export async function predictSignalSuccess(): Promise<SuccessPredictionOutput> {
  return await predictSignalSuccessFlow({});
}


// == Wallet Correlation Schemas and Flow ==

const CorrelationGroupSchema = z.object({
    wallets: z.array(z.string()).describe('A group of wallet addresses that trade together.'),
    tradeCount: z.number().describe('The number of correlated trades observed for this group.'),
    coins: z.array(z.string()).describe('The primary coins this group trades together.'),
});
export type CorrelationGroup = z.infer<typeof CorrelationGroupSchema>;

const WalletCorrelationsOutputSchema = z.object({
  groups: z.array(CorrelationGroupSchema).describe('A list of correlated wallet groups.'),
});
export type WalletCorrelationsOutput = z.infer<typeof WalletCorrelationsOutputSchema>;

const getWalletCorrelationsFlow = ai.defineFlow({
    name: 'getWalletCorrelationsFlow',
    inputSchema: z.object({}),
    outputSchema: WalletCorrelationsOutputSchema,
}, async () => {
    try {
        const signals = await getSignals();
        const recentSignals = signals.slice(0, 50);

        if (recentSignals.length < 5) {
            return { groups: [] };
        }

        const prompt = `
            Analyze the following list of trading signals. Each signal includes a list of contributing wallet addresses.
            Your task is to identify groups of 2 or more wallets that frequently appear together in the same signals. These are correlated wallets.

            Method:
            1. For each signal, look at the list of 'contributingWalletAddresses'.
            2. Find pairs or groups of addresses that appear together across multiple different signals.
            3. A correlation is stronger if the wallets trade together more often.
            4. Consolidate overlapping groups. For example, if (A, B) trade together and (B, C) trade together, they might form a group (A, B, C).
            5. For each identified group, list the wallets, count how many trades they made together, and list the coins they most commonly traded.

            Signal Data:
            ${recentSignals.map(s => `- Wallets: [${s.contributingWalletAddresses.join(', ')}], Coin: ${s.pair}`).join('\n')}

            Based on this analysis, return the identified groups of correlated wallets.
        `;
        
        const llmResponse = await ai.generate({
            prompt: prompt,
            output: {
                schema: WalletCorrelationsOutputSchema
            },
            config: { temperature: 0.1 }
        });
        
        const output = llmResponse.output();
        if (!output) {
            throw new Error("LLM failed to provide correlation data.");
        }
        
        // Sort groups by wallet count and then trade count
        output.groups.sort((a, b) => {
            if (b.wallets.length !== a.wallets.length) {
                return b.wallets.length - a.wallets.length;
            }
            return b.tradeCount - a.tradeCount;
        });

        return output;

    } catch (e: any) {
        await log({ level: 'ERROR', message: 'Failed to execute getWalletCorrelations flow', context: { error: e.message } });
        return { groups: [] };
    }
});


export async function getWalletCorrelations(): Promise<WalletCorrelationsOutput> {
    return await getWalletCorrelationsFlow({});
}
