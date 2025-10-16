
'use client';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Signal } from '@/server/services/signals';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  DollarSign,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { requestJson } from '@/lib/client/request';
import { Switch } from '@/components/ui/switch';

const listSignals = () => requestJson<Signal[]>('/api/signals');
const runDetectionApi = () => requestJson<Signal[]>('/api/signals/detect', { method: 'POST' });
const updateSignalPricesApi = () => requestJson<Signal[]>('/api/signals/update-prices', { method: 'POST' });
const deleteSignalApi = (id: string) =>
  requestJson<{ success: boolean }>(`/api/signals/${encodeURIComponent(id)}`, { method: 'DELETE' });

const SignalCard = ({ signal, onDelete }: { signal: Signal; onDelete: () => Promise<void> | void; }) => {
    const isProfitable = parseFloat(signal.pnl) >= 0;
    const signalTime = parseISO(signal.timestamp);
    const { toast } = useToast();

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this signal? This will remove it from view permanently.')) {
            return;
        }
        try {
            await deleteSignalApi(signal.id);
            toast({
                title: 'Success',
                description: 'Signal deleted successfully.',
            });
            await onDelete();
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to delete signal.',
            });
        }
    }
    
    const getStatusBadge = () => {
        switch (signal.status) {
            case 'Open':
                return <Badge variant="secondary">Open</Badge>
            case 'TP':
                return <Badge className="bg-green-600 text-white">Take Profit</Badge>
            case 'SL':
                return <Badge variant="destructive">Stop Loss</Badge>
        }
    }
    
    const walletVolumes = React.useMemo<Record<string, number>>(() => {
        if (!signal.clusterFills) return {};

        return signal.clusterFills.reduce((acc, fill) => {
            const address = fill.walletAddress;
            const size = Math.abs(parseFloat(fill.sz));
            if (!acc[address]) {
                acc[address] = 0;
            }
            acc[address] += size;
            return acc;
        }, {} as Record<string, number>);

    }, [signal.clusterFills]);
    
    return (
        <Card className={cn(
            "transition-transform duration-300 hover:-translate-y-1",
            signal.status !== 'Open' && "bg-muted/50 dark:bg-background/50"
        ))}> 
            <CardHeader>
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-3">
                            <Badge
                                variant={signal.type === 'SHORT' ? 'destructive' : 'default'}
                                className={cn(
                                    "py-1 px-4 text-base sm:text-lg",
                                    signal.type === 'LONG' && "bg-green-600 text-white hover:bg-green-600/80"
                                )}
                            >
                                {signal.type}
                            </Badge>
                            <CardTitle className="text-xl font-semibold sm:text-2xl">{signal.pair}-USDC</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Signal generated {formatDistanceToNow(signalTime, { addSuffix: true })}</span>
                        </div>
                    </div>
                   
                    <div className="flex w-full flex-wrap items-center gap-4 md:w-auto md:justify-end">
                        <div className="flex items-center gap-2 text-right">
                           {getStatusBadge()}
                        </div>
                         <div className="flex items-center gap-2 text-right">
                             <Users className="w-5 h-5 text-muted-foreground" />
                             <p className="text-lg font-semibold text-muted-foreground">{signal.contributingWallets} Wallets</p>
                         </div>
                         <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Delete Signal" className="md:ml-auto">
                             <Trash2 className="w-5 h-5 text-destructive" />
                         </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {/* Column 1: Core Signal Info */}
                    <div className="space-y-4">
                         <h4 className="font-semibold text-center md:text-left">Position Details</h4>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Avg. Entry Price</span>
                            <span className="font-mono font-medium">${signal.entryPrice}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Current Price</span>
                            <span className="font-mono font-medium">${signal.currentPrice}</span>
                         </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2"><Target className="w-4 h-4" />Avg. Liq. Price</span>
                            <span className="font-mono font-medium">{signal.liquidationPrice}</span>
                         </div>
                    </div>
                    {/* Column 2: Financials */}
                     <div className="space-y-4">
                         <h4 className="font-semibold text-center md:text-left">Financials</h4>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2"><Layers className="w-4 h-4" />Total Margin</span>
                            <span className="font-mono font-medium">${signal.margin}</span>
                         </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2"><Layers className="w-4 h-4" />Avg. Leverage</span>
                            <span className="font-mono font-medium">{signal.leverage}x</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm flex items-center gap-2">
                                {isProfitable ? <ArrowUp className="w-4 h-4 text-green-600" /> : <ArrowDown className="w-4 h-4 text-destructive" />}
                                {signal.status === 'Open' ? "Unrealized PnL / ROI" : "Final PnL / ROI"}
                            </span>
                            <span className={`font-mono font-bold text-lg ${isProfitable ? 'text-green-600' : 'text-destructive'}`}>${parseFloat(signal.pnl).toFixed(2)} ({parseFloat(signal.roi).toFixed(2)}%)</span>
                         </div>
                    </div>
                    {/* Column 3: Targets */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-center md:text-left">Targets</h4>
                         <div className="flex justify-between items-center">
                            <span className="text-destructive text-sm flex items-center gap-2"><Target className="w-4 h-4" />Stop Loss</span>
                            <span className="font-mono font-medium">${signal.stopLoss}</span>
                         </div>
                         {signal.takeProfitTargets.map((tp, index) => (
                             <div key={index} className="flex justify-between items-center">
                                <span className="text-green-600 text-sm flex items-center gap-2"><Target className="w-4 h-4" />Take Profit {index + 1}</span>
                                <span className="font-mono font-medium">${tp}</span>
                            </div>
                         ))}
                    </div>

                </div>

            </CardContent>
            <CardFooter>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-t">
                        <AccordionTrigger>
                           <div className="flex items-center gap-2 text-sm font-medium">
                                See Wallets ({signal.contributingWallets})
                           </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="p-4 bg-muted rounded-md font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
                                {Object.entries(walletVolumes).map(([address, volume]) => (
                                    <div key={address} className="flex justify-between">
                                        <span>{address}</span>
                                        <span className="font-semibold">{volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} {signal.pair}</span>
                                    </div>
                                ))}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardFooter>
        </Card>
    );
}

export default function SignalsPage() {
  const { toast } = useToast();
  const [signals, setSignals] = React.useState<Signal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [allPairs, setAllPairs] = React.useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPairs, setSelectedPairs] = React.useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = React.useState<Set<'LONG' | 'SHORT'>>(new Set(['LONG', 'SHORT']));
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<Signal['status']>>(new Set(['Open', 'TP', 'SL']));

  const applySignals = React.useCallback((nextSignals: Signal[]) => {
    setSignals(nextSignals);
    const uniquePairs = Array.from(new Set(nextSignals.map((signal) => signal.pair))).sort();
    setAllPairs(uniquePairs);
    setSelectedPairs((prev) => {
      const filtered = new Set(Array.from(prev).filter((pair) => uniquePairs.includes(pair)));
      if (filtered.size === prev.size) {
        let identical = true;
        prev.forEach((pair) => {
          if (!filtered.has(pair)) {
            identical = false;
          }
        });
        if (identical) {
          return prev;
        }
      }
      return filtered;
    });
    setLastUpdated(new Date());
    setErrorMessage(null);
  }, []);

  const fetchSignals = React.useCallback(
    async (options: { withLoader?: boolean; showToastOnError?: boolean } = {}) => {
      const { withLoader = false, showToastOnError = false } = options;
      if (withLoader) {
        setLoading(true);
      }
      try {
        const fetchedSignals = await listSignals();
        applySignals(fetchedSignals);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load signals.';
        setErrorMessage(message);
        if (showToastOnError) {
          toast({
            variant: 'destructive',
            title: 'Unable to load signals',
            description: message,
          });
        }
        return false;
      } finally {
        if (withLoader) {
          setLoading(false);
        }
      }
    },
    [applySignals, toast]
  );

  React.useEffect(() => {
    void fetchSignals({ withLoader: true, showToastOnError: true });
  }, [fetchSignals]);

  React.useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const interval = setInterval(() => {
      if (!document.hidden) {
        void fetchSignals();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSignals]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchSignals();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchSignals]);

  const handleManualRefresh = React.useCallback(async () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    const success = await fetchSignals({ showToastOnError: true });
    if (success) {
      toast({
        title: 'Signals refreshed',
        description: 'Latest data synced from the backend.',
      });
    }
    setIsRefreshing(false);
  }, [fetchSignals, isRefreshing, toast]);

  const handleRunDetection = React.useCallback(async () => {
    if (isDetecting) {
      return;
    }
    setIsDetecting(true);
    try {
      const detectedSignals = await runDetectionApi();
      applySignals(detectedSignals);
      toast({
        title: 'Detection completed',
        description:
          detectedSignals.length > 0
            ? 'Signals updated with the latest detection run.'
            : 'No new coordinated positions were detected.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detect new signals.';
      toast({
        variant: 'destructive',
        title: 'Detection failed',
        description: message,
      });
    } finally {
      setIsDetecting(false);
    }
  }, [applySignals, isDetecting, toast]);

  const handleSyncPrices = React.useCallback(async () => {
    if (isUpdatingPrices) {
      return;
    }
    setIsUpdatingPrices(true);
    try {
      const updatedSignals = await updateSignalPricesApi();
      applySignals(updatedSignals);
      toast({
        title: 'Prices synced',
        description: 'Open signal performance metrics were refreshed.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update signal prices.';
      toast({
        variant: 'destructive',
        title: 'Price sync failed',
        description: message,
      });
    } finally {
      setIsUpdatingPrices(false);
    }
  }, [applySignals, isUpdatingPrices, toast]);

  const handlePostMutation = React.useCallback(async () => {
    await fetchSignals({ showToastOnError: true });
  }, [fetchSignals]);

  const handlePairToggle = (pair: string) => {
    setSelectedPairs(prev => {
        const newSet = new Set(prev);
        if (newSet.has(pair)) {
            newSet.delete(pair);
        } else {
            newSet.add(pair);
        }
        return newSet;
    });
  };

  const handleTypeToggle = (type: 'LONG' | 'SHORT') => {
      setSelectedTypes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.add(type);
        }
        return newSet;
    });
  }

  const handleStatusToggle = (status: Signal['status']) => {
      setSelectedStatuses(prev => {
        const newSet = new Set(prev);
        if (newSet.has(status)) {
            newSet.delete(status);
        } else {
            newSet.add(status);
        }
        return newSet;
    });
  }

  const filteredSignals = React.useMemo(() => {
    return signals.filter(signal => {
        const searchMatch = signal.pair.toLowerCase().includes(searchQuery.toLowerCase());
        const pairMatch = selectedPairs.size === 0 || selectedPairs.has(signal.pair);
        const typeMatch = selectedTypes.has(signal.type);
        const statusMatch = selectedStatuses.has(signal.status);
        return searchMatch && pairMatch && typeMatch && statusMatch;
    });
  }, [signals, searchQuery, selectedPairs, selectedTypes, selectedStatuses]);

  const renderSignalContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      );
    }
    if (signals.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-10 space-y-2">
          <p className="text-lg">No active signals found.</p>
          <p>
            A signal is generated when at least 'N' tracked wallets open the same position within the last 'T' minutes.
          </p>
          <p className="text-sm">
            Check your detection settings and ensure the background worker is running (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run worker</code>
            ) so detection continues 24/7.
          </p>
        </div>
      );
    }
     if (filteredSignals.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-10">
            <p className="text-lg">No signals match your current filters.</p>
            <p>Try adjusting the filters to see more results.</p>
        </div>
      );
    }
    return (
        <div className="space-y-4">
            {filteredSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} onDelete={handlePostMutation} />
            ))}
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Active Signals</h1>
            <p className="text-muted-foreground">
              Live signals based on tracked wallet consensus. Data refreshes automatically.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {lastUpdated && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
              </div>
            )}
            {signals.length === 0 && !loading && (
              <span>
                Ensure the background worker (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run worker</code>
                ) is running to capture new signals 24/7.
              </span>
            )}
          </div>
          {errorMessage && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{errorMessage}</span>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={handleManualRefresh}
                disabled={isRefreshing || loading}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 rounded-md border px-3 py-1.5 bg-background/60">
            <span className="text-sm font-medium">Auto refresh</span>
            <Switch
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(Boolean(checked))}
              aria-label="Toggle auto refresh"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button onClick={handleRunDetection} disabled={isDetecting}>
              {isDetecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Target className="mr-2 h-4 w-4" />
              )}
              Run Detection
            </Button>
            <Button
              variant="secondary"
              onClick={handleSyncPrices}
              disabled={isUpdatingPrices}
            >
              {isUpdatingPrices ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-2 h-4 w-4" />
              )}
              Sync Prices
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:w-auto sm:flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by pair..."
                className="pl-8 sm:w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-1/3 sm:w-auto flex-grow sm:flex-grow-0">
                          Pairs ({selectedPairs.size > 0 ? selectedPairs.size : 'All'})
                          <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by Pair</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allPairs.map(pair => (
                          <DropdownMenuCheckboxItem
                              key={pair}
                              checked={selectedPairs.has(pair)}
                              onCheckedChange={() => handlePairToggle(pair)}
                          >
                              {pair}
                          </DropdownMenuCheckboxItem>
                      ))}
                      {allPairs.length === 0 && <DropdownMenuItem disabled>No pairs found</DropdownMenuItem>}
                  </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-1/3 sm:w-auto flex-grow sm:flex-grow-0">
                          Type ({selectedTypes.size})
                          <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                          checked={selectedTypes.has('LONG')}
                          onCheckedChange={() => handleTypeToggle('LONG')}
                      >
                          Long
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                          checked={selectedTypes.has('SHORT')}
                          onCheckedChange={() => handleTypeToggle('SHORT')}
                      >
                          Short
                      </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
              </DropdownMenu>

               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-1/3 sm:w-auto flex-grow sm:flex-grow-0">
                          Status ({selectedStatuses.size})
                          <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                          checked={selectedStatuses.has('Open')}
                          onCheckedChange={() => handleStatusToggle('Open')}
                      >
                          Open
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                          checked={selectedStatuses.has('TP')}
                          onCheckedChange={() => handleStatusToggle('TP')}
                      >
                          Take Profit
                      </DropdownMenuCheckboxItem>
                       <DropdownMenuCheckboxItem
                          checked={selectedStatuses.has('SL')}
                          onCheckedChange={() => handleStatusToggle('SL')}
                      >
                          Stop Loss
                      </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </CardContent>
      </Card>
      
      {renderSignalContent()}

    </div>
  );
}
