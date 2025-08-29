
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
import { getSignals, Signal, deleteSignal, detectAndSaveSignals, updateSignalPrices } from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ChevronDown, Clock, DollarSign, Layers, Search, Target, Trash2, TrendingUp, Users } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const SignalCard = ({ signal, onDelete }: { signal: Signal; onDelete: () => void; }) => {
    const isProfitable = parseFloat(signal.pnl) >= 0;
    const signalTime = parseISO(signal.timestamp);
    const { toast } = useToast();

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this signal? This will remove it from view permanently.')) {
            return;
        }
        try {
            await deleteSignal(signal.id);
            toast({
                title: 'Success',
                description: 'Signal deleted successfully.',
            });
            onDelete(); // This will trigger a refetch in the parent
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
    
    const walletVolumes = React.useMemo(() => {
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
        <Card className={cn(signal.status !== 'Open' && "bg-muted/50 dark:bg-background/50")}>
            <CardHeader>
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-3">
                            <Badge
                                variant={signal.type === 'SHORT' ? 'destructive' : 'default'}
                                className={cn(
                                    "text-lg py-1 px-4",
                                    signal.type === 'LONG' && "bg-green-600 text-white hover:bg-green-600/80"
                                )}
                            >
                                {signal.type}
                            </Badge>
                            <CardTitle className="text-2xl">{signal.pair}-USDC</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Signal generated {formatDistanceToNow(signalTime, { addSuffix: true })}</span>
                        </div>
                    </div>
                   
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto md:justify-end">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  const [signals, setSignals] = React.useState<Signal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [allPairs, setAllPairs] = React.useState<string[]>([]);
  
  // Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPairs, setSelectedPairs] = React.useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = React.useState<Set<'LONG' | 'SHORT'>>(new Set(['LONG', 'SHORT']));
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<Signal['status']>>(new Set(['Open', 'TP', 'SL']));

  const refetchSignals = React.useCallback(async () => {
    try {
        const fetchedSignals = await getSignals();
        setSignals(fetchedSignals);
        const uniquePairs = Array.from(new Set(fetchedSignals.map(s => s.pair)));
        setAllPairs(uniquePairs);
    } catch (error) {
        console.error("Failed to refetch signals", error);
    }
  }, []);
  
  const fetchInitialSignals = React.useCallback(async () => {
    setLoading(true);
    try {
        await detectAndSaveSignals(); // Run detection on first load
        await refetchSignals();
    } catch (error) {
        console.error("Failed to fetch initial signals", error);
    } finally {
        setLoading(false);
    }
  }, [refetchSignals]);

  const runDetection = React.useCallback(async () => {
      if (isDetecting) return;
      setIsDetecting(true);
      try {
          await detectAndSaveSignals();
          await refetchSignals();
      } catch (error) {
          console.error("Failed to detect new signals", error);
      } finally {
          setIsDetecting(false);
      }
  }, [isDetecting, refetchSignals]);

  const updatePrices = React.useCallback(async () => {
    if (document.hidden) return; // Don't update if the tab is not visible
    try {
        const updatedSignals = await updateSignalPrices();
        if (updatedSignals.length > 0) {
            setSignals(updatedSignals);
        }
    } catch (error) {
        console.error("Failed to update signal prices", error);
    }
  }, []);

  React.useEffect(() => {
    fetchInitialSignals();
    // Set up intervals
    const detectionInterval = setInterval(runDetection, 60000); // Detect every 60 seconds
    const priceUpdateInterval = setInterval(updatePrices, 15000); // Update prices every 15 seconds

    return () => {
        clearInterval(detectionInterval);
        clearInterval(priceUpdateInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
        <div className="text-center text-muted-foreground py-10">
            <p className="text-lg">No active signals found.</p>
            <p>A signal is generated when at least 'N' tracked wallets open the same position within the last 'T' minutes.</p>
             <p className='mt-2 text-sm'>Check your settings for the 'Min Wallet Count (N)' and 'Time Window (T)' values.</p>
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
                <SignalCard key={signal.id} signal={signal} onDelete={refetchSignals} />
            ))}
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-2xl font-bold tracking-tight">Active Signals</h1>
        <p className="text-muted-foreground">
            Live signals based on tracked wallet consensus. Data refreshes automatically.
        </p>
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
