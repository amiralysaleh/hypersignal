
'use client';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getWalletData } from '@/ai/flows/get-wallet-data';
import { findWalletsByCoin, WalletPosition } from '@/ai/flows/find-wallets-by-coin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowDown, ArrowUp, Copy, Terminal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type WalletData = {
  pnl: string;
  roi: string;
  positions: any[];
};

export default function ExplorerPage() {
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = React.useState('');
  const [walletLoading, setWalletLoading] = React.useState(false);
  const [walletData, setWalletData] = React.useState<WalletData | null>(null);
  const [walletError, setWalletError] = React.useState<string | null>(null);

  const [coin, setCoin] = React.useState('');
  const [coinLoading, setCoinLoading] = React.useState(false);
  const [coinPositions, setCoinPositions] = React.useState<WalletPosition[] | null>(null);
  const [coinError, setCoinError] = React.useState<string | null>(null);
  const [trackedWalletCount, setTrackedWalletCount] = React.useState<number | null>(null);

  const handleWalletSearch = async () => {
    if (!walletAddress) {
      setWalletError('Please enter a wallet address.');
      return;
    }
    setWalletError(null);
    setWalletLoading(true);
    setWalletData(null);
    try {
      const data = await getWalletData({ address: walletAddress });
      setWalletData(data);
    } catch (e: any) {
      setWalletError(e.message || 'An unexpected error occurred.');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleCoinSearch = async () => {
    if (!coin) {
      setCoinError('Please enter a coin symbol.');
      return;
    }
    setCoinError(null);
    setCoinLoading(true);
    setCoinPositions(null);
    setTrackedWalletCount(null);
    try {
      const data = await findWalletsByCoin({ coin });
      // Sort by position value descending
      const sortedPositions = data.positions.sort((a, b) => parseFloat(b.positionValue) - parseFloat(a.positionValue));
      setCoinPositions(sortedPositions);
      setTrackedWalletCount(data.trackedWalletCount);
    } catch (e: any) {
      setCoinError(e.message || 'An unexpected error occurred.');
      setTrackedWalletCount(null);
    } finally {
      setCoinLoading(false);
    }
  };
  
  const longPositions = React.useMemo(() => coinPositions?.filter(p => p.direction === 'LONG') ?? [], [coinPositions]);
  const shortPositions = React.useMemo(() => coinPositions?.filter(p => p.direction === 'SHORT') ?? [], [coinPositions]);
  const walletInsights = React.useMemo(() => {
    if (!walletData) {
      return {
        totalPositions: 0,
        longCount: 0,
        shortCount: 0,
        totalExposure: 0,
      };
    }

    return walletData.positions.reduce(
      (acc, pos) => {
        const details = pos?.position ?? {};
        const size = parseFloat(details.szi ?? '0');
        const entryPx = parseFloat(details.entryPx ?? '0');

        if (Number.isFinite(size) && Number.isFinite(entryPx) && size !== 0) {
          acc.totalExposure += Math.abs(size) * entryPx;
          if (size > 0) {
            acc.longCount += 1;
          } else {
            acc.shortCount += 1;
          }
        }

        return acc;
      },
      {
        totalPositions: walletData.positions.length,
        longCount: 0,
        shortCount: 0,
        totalExposure: 0,
      }
    );
  }, [walletData]);

  const handleCopyCoinResults = React.useCallback(async () => {
    if (!coinPositions || coinPositions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to copy yet',
        description: 'Run a coin search to load wallet addresses before copying.',
      });
      return;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(coinPositions.map((p) => p.address).join('\n'));
      toast({
        title: 'Wallets copied',
        description: `${coinPositions.length} wallet${coinPositions.length === 1 ? '' : 's'} copied to the clipboard.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to copy',
        description: 'Your browser blocked clipboard access. Please copy the table manually.',
      });
    }
  }, [coinPositions, toast]);


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="text-muted-foreground">
          Explore data from any Hyperliquid wallet or find wallets by coin.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Explorer</CardTitle>
              <CardDescription>
                Enter a wallet address to view its performance and positions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="text"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  disabled={walletLoading}
                />
                <Button onClick={handleWalletSearch} disabled={walletLoading} className="w-full sm:w-auto">
                  {walletLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {walletError && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{walletError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Coin Explorer</CardTitle>
              <CardDescription>
                Find which of your tracked wallets hold a specific coin.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="text"
                  placeholder="e.g. BTC"
                  value={coin}
                  onChange={(e) => setCoin(e.target.value)}
                  disabled={coinLoading}
                />
                <Button onClick={handleCoinSearch} disabled={coinLoading} className="w-full sm:w-auto">
                  {coinLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {coinError && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{coinError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
      </div>
      
      {walletData && (
        <>
          <Separator />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Wallet Search Results</h2>
            <Badge variant="outline" className="w-fit">
              {walletInsights.totalPositions} open position{walletInsights.totalPositions === 1 ? '' : 's'} tracked
            </Badge>
          </div>
          <div className="grid gap-4 xl:grid-cols-7">
            <div className="space-y-4 xl:col-span-2">
              <Card className="border border-primary/20 bg-primary/5 shadow-sm dark:bg-primary/10">
                <CardHeader>
                  <CardTitle>Overall Performance</CardTitle>
                  <CardDescription>Real-time snapshot of this wallet's profitability.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Total Unrealized PnL</Label>
                    <p className={cn('text-2xl font-bold', parseFloat(walletData.pnl) >= 0 ? 'text-green-600' : 'text-destructive')}>
                      ${parseFloat(walletData.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Current ROI</Label>
                    <p className={cn('text-2xl font-bold', parseFloat(walletData.roi) >= 0 ? 'text-green-600' : 'text-destructive')}>
                      {parseFloat(walletData.roi).toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Trading Breakdown</CardTitle>
                  <CardDescription>Directional exposure and total capital at work.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm shadow-sm dark:bg-background/40">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Long positions</p>
                    <p className="text-xl font-semibold text-green-600">{walletInsights.longCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm shadow-sm dark:bg-background/40">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Short positions</p>
                    <p className="text-xl font-semibold text-destructive">{walletInsights.shortCount}</p>
                  </div>
                  <div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm shadow-sm dark:bg-background/40">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Total exposure</p>
                    <p className="text-xl font-semibold">${walletInsights.totalExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="xl:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle>Open Positions</CardTitle>
                  <CardDescription>All currently open positions for this wallet.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {walletData.positions.length > 0 ? (
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Coin</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Entry Price</TableHead>
                          <TableHead className="text-right">Unrealized PnL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {walletData.positions.map((pos) => {
                          const details = pos.position ?? {};
                          const size = parseFloat(details.szi ?? '0');
                          const isLong = size > 0;
                          const pnl = parseFloat(pos.unrealizedPnl ?? '0');
                          const entryPx = parseFloat(details.entryPx ?? '0');

                          return (
                            <TableRow key={details.coin ?? `${details.entryPx}-${details.szi}`}>
                              <TableCell className="font-medium">{details.coin ?? '—'}</TableCell>
                              <TableCell>
                                <Badge variant={isLong ? 'default' : 'destructive'} className={cn('inline-flex items-center gap-1', isLong && 'bg-green-600 text-white')}>
                                  {isLong ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                  {isLong ? 'LONG' : 'SHORT'}
                                </Badge>
                              </TableCell>
                              <TableCell>{Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</TableCell>
                              <TableCell>${Number.isFinite(entryPx) ? entryPx.toLocaleString() : '—'}</TableCell>
                              <TableCell className={cn('text-right font-medium', pnl >= 0 ? 'text-green-600' : 'text-destructive')}>
                                ${Number.isFinite(pnl) ? pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="py-4 text-center text-muted-foreground">No open positions found.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {coinPositions && (
        <>
          <Separator />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Coin Search Results for "{coin.toUpperCase()}"
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {typeof trackedWalletCount === 'number' && (
                <Badge variant="outline">
                  Tracking {trackedWalletCount} wallet{trackedWalletCount === 1 ? '' : 's'}
                </Badge>
              )}
              <Badge variant="secondary">
                {coinPositions.length} result{coinPositions.length === 1 ? '' : 's'}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyCoinResults}
                disabled={coinLoading || coinPositions.length === 0}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy wallets
              </Button>
            </div>
          </div>
          {trackedWalletCount === 0 && (
            <Alert>
              <AlertTitle>No tracked wallets yet</AlertTitle>
              <AlertDescription>
                Add wallets to your watchlist to enable coin discovery.{' '}
                <Link href="/wallets" className="font-medium text-primary underline">
                  Manage tracked wallets
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUp className="h-5 w-5 text-green-600" />
                    Long Positions
                  </CardTitle>
                  <Badge variant="outline">{longPositions.length}</Badge>
                </div>
                <CardDescription>Wallets currently net long on {coin.toUpperCase()}.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {longPositions.length > 0 ? (
                  <Table className="min-w-[600px] text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Value (USD)</TableHead>
                        <TableHead className="text-right">Opened</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {longPositions.map((p) => (
                        <TableRow key={`${p.address}-long`}>
                          <TableCell className="font-mono text-xs">{p.address}</TableCell>
                          <TableCell>${parseFloat(p.entryPrice).toLocaleString()}</TableCell>
                          <TableCell>${parseFloat(p.positionValue).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <span title={format(parseISO(p.timestamp), 'PPpp')}>
                              {formatDistanceToNow(parseISO(p.timestamp), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    No tracked wallets are currently long {coin.toUpperCase()}.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDown className="h-5 w-5 text-destructive" />
                    Short Positions
                  </CardTitle>
                  <Badge variant="outline">{shortPositions.length}</Badge>
                </div>
                <CardDescription>Wallets currently net short on {coin.toUpperCase()}.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {shortPositions.length > 0 ? (
                  <Table className="min-w-[600px] text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Value (USD)</TableHead>
                        <TableHead className="text-right">Opened</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shortPositions.map((p) => (
                        <TableRow key={`${p.address}-short`}>
                          <TableCell className="font-mono text-xs">{p.address}</TableCell>
                          <TableCell>${parseFloat(p.entryPrice).toLocaleString()}</TableCell>
                          <TableCell>${parseFloat(p.positionValue).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <span title={format(parseISO(p.timestamp), 'PPpp')}>
                              {formatDistanceToNow(parseISO(p.timestamp), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    No tracked wallets are currently short {coin.toUpperCase()}.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

    </div>
  );
}
