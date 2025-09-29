
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useTransition } from 'react';
import { getSettings, saveSettings, Settings } from './actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const profiles = {
  highQuality: {
    minWalletCount: 10,
    timeWindow: 5,
    minVolume: 5000,
    walletPollInterval: 30,
    pricePollInterval: 15
  },
  balanced: {
    minWalletCount: 5,
    timeWindow: 10,
    minVolume: 1000,
    walletPollInterval: 60,
    pricePollInterval: 30
  },
  highFrequency: {
    minWalletCount: 2,
    timeWindow: 15,
    minVolume: 500,
    walletPollInterval: 90,
    pricePollInterval: 45,
  }
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [selectedProfile, setSelectedProfile] = useState<string>('custom');

  useEffect(() => {
    startTransition(async () => {
      const currentSettings = await getSettings();
      setSettings(currentSettings);
    });
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value, type } = e.target;
    const isNumber = type === 'number';
    setSettings((prev) => ({ ...prev, [id]: isNumber ? Number(value) : value }));
    setSelectedProfile('custom');
  };

  const handleSwitchChange = (checked: boolean, id: string) => {
    setSettings((prev) => ({ ...prev, [id]: checked }));
    setSelectedProfile('custom');
  };
  
  const handleProfileChange = (profileKey: string) => {
    if (profileKey === 'custom') {
      setSelectedProfile('custom');
      return;
    }
    const profile = profiles[profileKey as keyof typeof profiles];
    if (profile) {
      setSettings(prev => ({...prev, ...profile}));
      setSelectedProfile(profileKey);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveSettings(settings as Settings);
        toast({
          title: 'Success',
          description: 'Settings saved successfully.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save settings.',
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure the signal detection and alert parameters.
        </p>
      </div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="pairs">Pairs</TabsTrigger>
        </TabsList>

        <form className="mt-6" onSubmit={handleSubmit}>
          <Card>
             <TabsContent value="general" className="mt-0">
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure core detection and polling parameters. Select a profile or customize below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="signal-profile">Signal Profile</Label>
                    <Select onValueChange={handleProfileChange} value={selectedProfile}>
                        <SelectTrigger className="w-full md:w-1/3">
                            <SelectValue placeholder="Select a profile" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="highQuality">High-Quality</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="highFrequency">High-Frequency</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="minWalletCount">Min Wallet Count (N)</Label>
                        <Input id="minWalletCount" type="number" value={settings.minWalletCount || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="timeWindow">Time Window (T, in minutes)</Label>
                        <Input id="timeWindow" type="number" value={settings.timeWindow || ''} onChange={handleInputChange} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="minVolume">Min Signal Volume ($)</Label>
                        <Input id="minVolume" type="number" value={settings.minVolume || ''} onChange={handleInputChange} />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="walletPollInterval">Wallet Poll Interval (sec)</Label>
                        <Input id="walletPollInterval" type="number" value={settings.walletPollInterval || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pricePollInterval">Price Poll Interval (sec)</Label>
                        <Input id="pricePollInterval" type="number" value={settings.pricePollInterval || ''} onChange={handleInputChange} />
                    </div>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="trading" className="mt-0">
              <CardHeader>
                <CardTitle>Trading Parameters</CardTitle>
                <CardDescription>Set default stop-loss, take-profit, and other trade-related settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="defaultStopLoss">Default Stop Loss (%)</Label>
                        <Input id="defaultStopLoss" type="number" step="0.1" value={settings.defaultStopLoss || ''} onChange={handleInputChange} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="takeProfitTargets">Take Profit Targets (%)</Label>
                        <Input id="takeProfitTargets" placeholder="e.g., 2.0, 3.5, 5.0" value={settings.takeProfitTargets || ''} onChange={handleInputChange} />
                        <p className="text-sm text-muted-foreground">Comma-separated values.</p>
                    </div>
                 </div>
                 <div className="flex items-center space-x-2 pt-4">
                    <Switch id="includeFunding" checked={settings.includeFunding || false} onCheckedChange={(c) => handleSwitchChange(c, 'includeFunding')} />
                    <Label htmlFor="includeFunding">Include funding rates in PnL calculation</Label>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="alerts" className="mt-0">
              <CardHeader>
                <CardTitle>Telegram Alerts</CardTitle>
                <CardDescription>Configure your Telegram bot and alert channels.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="telegramBotToken">Telegram Bot Token</Label>
                  <Input id="telegramBotToken" type="password" value={settings.telegramBotToken || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramChannelIds">Alert Channel IDs</Label>
                  <Textarea id="telegramChannelIds" placeholder="Enter one channel ID per line" value={settings.telegramChannelIds || ''} onChange={handleInputChange} />
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="pairs" className="mt-0">
                <CardHeader>
                    <CardTitle>Monitored Pairs</CardTitle>
                    <CardDescription>Define which pairs to monitor and map them if necessary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="monitoredPairs">Pairs to Monitor</Label>
                        <Textarea id="monitoredPairs" placeholder="e.g., ETH, BTC, SOL" value={settings.monitoredPairs || ''} onChange={handleInputChange} />
                        <p className="text-sm text-muted-foreground">Comma-separated list of coins (e.g., ETH, BTC).</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quoteCurrencies">Quote Currencies</Label>
                        <Textarea id="quoteCurrencies" placeholder="e.g., USDT, USDC" value={settings.quoteCurrencies || ''} onChange={handleInputChange} />
                        <p className="text-sm text-muted-foreground">Comma-separated list of quote currencies.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ignoredPairs">Pairs to Ignore</Label>
                        <Textarea id="ignoredPairs" placeholder="e.g., MEME, PEPE" value={settings.ignoredPairs || ''} onChange={handleInputChange} />
                        <p className="text-sm text-muted-foreground">Comma-separated list of coins.</p>
                    </div>
                </CardContent>
            </TabsContent>

            <CardFooter className="border-t pt-6">
              <div className="flex w-full justify-end">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Tabs>
    </div>
  );
}
