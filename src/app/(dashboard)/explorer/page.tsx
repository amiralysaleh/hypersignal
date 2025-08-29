
'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getWalletData } from '@/ai/flows/get-wallet-data';
import { findWalletsByCoin, WalletPosition } from '@/ai/flows/find-wallets-by-coin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowDown, ArrowUp, Terminal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WalletData = {
  pnl: string;
  roi: string;
  positions: any[];
};

export default function ExplorerPage() {
  const [walletAddress, setWalletAddress] = React.useState('');
  const [walletLoading, setWalletLoading] = React.useState(false);
  const [walletData, setWalletData] = React.useState<WalletData | null>(null);
  const [walletError, setWalletError] = React.useState<string | null>(null);

  const [coin, setCoin] = React.useState('');
  const [coinLoading, setCoinLoading] = React.useState(false);
  const [coinPositions, setCoinPositions] = React.useState<WalletPosition[] | null>(null);
  const [coinError, setCoinError] = React.useState<string | null>(null);

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
    try {
      const data = await findWalletsByCoin({ coin });
      // Sort by position value descending
      const sortedPositions = data.positions.sort((a, b) => parseFloat(b.positionValue) - parseFloat(a.positionValue));
      setCoinPositions(sortedPositions);
    } catch (e: any) {
      setCoinError(e.message || 'An unexpected error occurred.');
    } finally {
      setCoinLoading(false);
    }
  };
  
  const longPositions = React.useMemo(() => coinPositions?.filter(p => p.direction === 'LONG') ?? [], [coinPositions]);
  const shortPositions = React.useMemo(() => coinPositions?.filter(p => p.direction === 'SHORT') ?? [], [coinPositions]);


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="text-muted-foreground">
          Explore data from any Hyperliquid wallet or find wallets by coin.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Explorer</CardTitle>
              <CardDescription>
                Enter a wallet address to view its performance and positions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex w-full max-w-md items-center space-x-2">
                <Input
                  type="text"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  disabled={walletLoading}
                />
                <Button onClick={handleWalletSearch} disabled={walletLoading}>
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
              <div className="flex w-full max-w-md items-center space-x-2">
                <Input
                  type="text"
                  placeholder="e.g. BTC"
                  value={coin}
                  onChange={(e) => setCoin(e.target.value)}
                  disabled={coinLoading}
                />
                <Button onClick={handleCoinSearch} disabled={coinLoading}>
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
            <h2 className="text-xl font-semibold tracking-tight">Wallet Search Results</h2>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-2 space-y-4">
                     <Card>
                        <CardHeader>
                          <CardTitle>Overall Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-muted-foreground">Total Unrealized PnL</Label>
                            <p className={cn("text-2xl font-bold", parseFloat(walletData.pnl) >= 0 ? "text-green-600" : "text-destructive")}>${walletData.pnl}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Current ROI</Label>
                            <p className={cn("text-2xl font-bold", parseFloat(walletData.roi) >= 0 ? "text-green-600" : "text-destructive")}>{walletData.roi}%</p>
                          </div>
                        </CardContent>
                      </Card>
                </div>
              <div className="lg:col-span-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Open Positions</CardTitle>
                    <CardDescription>All currently open positions for this wallet.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {walletData.positions.length > 0 ? (
                       <Table>
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
                                const details = pos.position;
                                const size = parseFloat(details.szi);
                                const isLong = size > 0;
                                const pnl = parseFloat(pos.unrealizedPnl);
                                return (
                                <TableRow key={details.coin}>
                                    <TableCell className="font-medium">{details.coin}</TableCell>
                                    <TableCell>
                                        <Badge variant={isLong ? 'default' : 'destructive'} className={cn(isLong && 'bg-green-600 text-white')}>
                                            {isLong ? <ArrowUp className="h-3 w-3 mr-1"/> : <ArrowDown className="h-3 w-3 mr-1"/>}
                                            {isLong ? 'LONG' : 'SHORT'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</TableCell>
                                    <TableCell>${parseFloat(details.entryPx).toLocaleString()}</TableCell>
                                    <TableCell className={cn("text-right font-medium", pnl >= 0 ? "text-green-600" : "text-destructive")}>${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                       </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No open positions found.</p>
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
          <h2 className="text-xl font-semibold tracking-tight">
            Coin Search Results for "{coin.toUpperCase()}"
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowUp className="h-5 w-5 text-green-600"/>
                        Long Positions
                    </CardTitle>
                    <CardDescription>{longPositions.length} wallet(s) with long positions.</CardDescription>
                </CardHeader>
                <CardContent>
                    {longPositions.length > 0 ? (
                        <Table>
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
                                <TableRow key={p.address}>
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
                        <p className="text-sm text-muted-foreground">No tracked wallets are currently long {coin.toUpperCase()}.</p>
                    )}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowDown className="h-5 w-5 text-destructive"/>
                        Short Positions
                    </CardTitle>
                    <CardDescription>{shortPositions.length} wallet(s) with short positions.</CardDescription>
                </CardHeader>
                <CardContent>
                     {shortPositions.length > 0 ? (
                        <Table>
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
                                <TableRow key={p.address}>
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
                        <p className="text-sm text-muted-foreground">No tracked wallets are currently short {coin.toUpperCase()}.</p>
                    )}
                </CardContent>
            </Card>
          </div>
        </>
      )}

    </div>
  );
}
