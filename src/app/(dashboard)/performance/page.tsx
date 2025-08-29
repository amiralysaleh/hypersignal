
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPerformanceData, WalletPerformance } from './actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function PerformancePage() {
  const [performanceData, setPerformanceData] = React.useState<WalletPerformance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [timeframe, setTimeframe] = React.useState('30d');

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getPerformanceData(timeframe);
        setPerformanceData(data);
      } catch (error) {
        console.error("Failed to fetch performance data", error);
        // Optionally, show a toast notification
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeframe]);


  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground">Analyze performance of tracked wallets.</p>
        </div>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wallet Rankings</CardTitle>
          <CardDescription>Top performing wallets by PnL.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead className="text-right">Success Rate</TableHead>
                <TableHead className="text-right">Total PnL</TableHead>
                <TableHead className="text-right">Total Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : performanceData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No data available.</TableCell>
                </TableRow>
              ) : (
                performanceData.map((wallet) => (
                  <TableRow key={wallet.rank}>
                    <TableCell className="font-bold">{wallet.rank}</TableCell>
                    <TableCell className="font-mono">{wallet.address}</TableCell>
                    <TableCell className="text-right">{wallet.successRate}%</TableCell>
                    <TableCell className={`text-right font-medium ${wallet.pnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      ${wallet.pnl.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{wallet.trades}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
