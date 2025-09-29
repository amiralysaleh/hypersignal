
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Search, Trash2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getWallets, addWallet, deleteWallet, Wallet, toggleWalletFavorite } from './actions';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function WalletsPage() {
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [newAddress, setNewAddress] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const { toast } = useToast();

  const fetchWallets = React.useCallback(async () => {
    try {
      setLoading(true);
      const fetchedWallets = await getWallets();
      setWallets(fetchedWallets);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch wallets.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchWallets();
    const interval = setInterval(fetchWallets, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchWallets]);

  const handleAddWallet = async () => {
    if (!newAddress.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Wallet address cannot be empty.',
      });
      return;
    }
    try {
      const newWallet = await addWallet(newAddress);
      setWallets((prev) => [...prev, newWallet]);
      setNewAddress('');
      setOpen(false);
      toast({
        title: 'Success',
        description: 'Wallet added successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add wallet.',
      });
    }
  };

  const handleDeleteWallet = async (address: string) => {
     if (!confirm('Are you sure you want to delete this wallet?')) {
      return;
    }
    try {
      await deleteWallet(address);
      setWallets((prev) => prev.filter((w) => w.address !== address));
      toast({
        title: 'Success',
        description: 'Wallet deleted successfully.',
      });
    } catch (error: any) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete wallet.',
      });
    }
  };
  
  const handleToggleFavorite = async (address: string) => {
    try {
        const updatedWallet = await toggleWalletFavorite(address);
        setWallets(prev => 
            prev.map(w => w.address === address ? updatedWallet : w)
        );
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to update favorite status.',
        });
    }
  }

  const calculateWinRate = (wallet: Wallet) => {
    if (wallet.totalTrades === 0) {
        return '0.00';
    }
    return ((wallet.winningTrades / wallet.totalTrades) * 100).toFixed(2);
  }

  const filteredWallets = React.useMemo(() => {
    return wallets
      .filter(wallet => 
        wallet.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
          // Favorites first, then by date added
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return new Date(b.addedOn).getTime() - new Date(a.addedOn).getTime();
      });
  }, [wallets, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>
          <p className="text-muted-foreground">Manage your tracked wallets.</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
           <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by address..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Wallet</DialogTitle>
                <DialogDescription>
                  Enter the Hyperliquid wallet address to start tracking.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">
                    Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="0x..."
                    className="col-span-3 font-mono"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddWallet}>
                  Add Wallet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead>Total PnL</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Total Trades</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                  ))
                ) : filteredWallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">{wallets.length === 0 ? 'No wallets added.' : 'No wallets found for your search.'}</TableCell>
                  </TableRow>
                ) : (
                  filteredWallets.map((wallet) => (
                    <TableRow key={wallet.address}>
                       <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleFavorite(wallet.address)}>
                               <Star className={cn("h-4 w-4", wallet.favorite ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                          </Button>
                       </TableCell>
                      <TableCell className="font-mono text-xs md:text-sm break-all">{wallet.address}</TableCell>
                       <TableCell>{format(new Date(wallet.addedOn), 'PPP')}</TableCell>
                      <TableCell className={`font-medium ${wallet.totalPnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                         ${wallet.totalPnl.toFixed(2)}
                      </TableCell>
                      <TableCell>{calculateWinRate(wallet)}%</TableCell>
                      <TableCell>{wallet.totalTrades}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDeleteWallet(wallet.address)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
