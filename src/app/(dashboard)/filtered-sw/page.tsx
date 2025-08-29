
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { predictSignalSuccess, getWalletCorrelations, CorrelationGroup } from './actions';
import { ShieldCheck, Bot, Users } from 'lucide-react';

export default function FilteredSwPage() {
    const [successProbability, setSuccessProbability] = React.useState<number | null>(null);
    const [correlationGroups, setCorrelationGroups] = React.useState<CorrelationGroup[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        try {
            setLoading(true);
            const [probData, corrData] = await Promise.all([
                predictSignalSuccess(),
                getWalletCorrelations(),
            ]);
            setSuccessProbability(probData.successProbability);
            setCorrelationGroups(corrData.groups);
        } catch (error) {
            console.error("Failed to fetch filtered data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Predictor</h1>
                <p className="text-muted-foreground">
                    Leverage AI to predict signal success and detect wallet correlations.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bot className="w-6 h-6" /> Signal Success Prediction</CardTitle>
                        <CardDescription>AI-powered prediction of the next signal's success probability based on historical data.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                             <Skeleton className="h-24 w-full" />
                        ) : successProbability !== null ? (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-muted-foreground">Probability of TP</span>
                                    <span className="font-bold text-2xl text-primary">{successProbability.toFixed(1)}%</span>
                                </div>
                                <Progress value={successProbability} className="w-full" />
                                <p className="text-xs text-muted-foreground mt-2 text-center">Based on analysis of recent signal performance and market conditions.</p>
                            </div>
                        ) : (
                             <p className="text-center text-muted-foreground py-8">Not enough data to make a prediction.</p>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="w-6 h-6" /> Wallet Correlation</CardTitle>
                        <CardDescription>Groups of wallets that frequently trade in the same direction, indicating potential coordination.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : correlationGroups.length > 0 ? (
                           <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                               {correlationGroups.map((group, index) => (
                                   <div key={index} className="p-3 bg-muted rounded-lg">
                                       <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-semibold">Group {index + 1}</h3>
                                            <div className="text-sm text-muted-foreground">
                                                <span className="font-bold">{group.wallets.length}</span> Wallets | <span className="font-bold">{group.tradeCount}</span> Trades
                                            </div>
                                       </div>
                                       <div className="font-mono text-xs space-y-1">
                                           {group.wallets.map(wallet => <p key={wallet}>{wallet}</p>)}
                                       </div>
                                   </div>
                               ))}
                           </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No significant wallet correlations found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
