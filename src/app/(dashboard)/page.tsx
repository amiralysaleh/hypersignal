
'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CartesianGrid, Pie, PieChart, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, Legend, LineChart, Line } from 'recharts';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle, Clock, Signal, TrendingUp, Trophy, Users, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DashboardData } from '@/server/services/dashboard';
import { requestJson } from '@/lib/client/request';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const chartConfig = {
  winrate: {
    label: 'Win Rate (%)',
    color: 'hsl(var(--chart-1))',
  },
};

const pieChartColors = {
  'Take Profit': 'hsl(var(--chart-1))',
  'Stop Loss': 'hsl(var(--destructive))',
  'Open': 'hsl(var(--chart-2))',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dashboardData = await requestJson<DashboardData>('/api/dashboard');
        setData(dashboardData);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    fetchData();

    return () => clearInterval(interval);
  }, []);
  
  const pieData = data ? Object.entries(data.signalOutcomes).map(([name, value]) => ({ name, value, fill: pieChartColors[name as keyof typeof pieChartColors] })) : [];
  const topPairs = data?.topPairs ?? [];
  const standoutSignals = data?.standoutSignals ?? [];
  const attentionSignals = data?.attentionSignals ?? [];
  
  const StatsCard = ({ title, value, subtext, icon: Icon, isLoading }: { title: string, value: string | React.ReactNode, subtext: string, icon: React.ElementType, isLoading: boolean }) => (
    <Card className="group relative overflow-hidden border-border/60 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-balance sm:text-base">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="relative">
        {isLoading ? (
          <>
            <Skeleton className="mb-2 h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold md:text-3xl">{value}</div>
            <p className="text-xs text-muted-foreground md:text-sm">{subtext}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
  
  const getStatusBadge = (status: 'TP' | 'SL' | 'Open') => {
        switch (status) {
            case 'Open':
                return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3"/>Open</Badge>
            case 'TP':
                return <Badge className="bg-green-600 text-white flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Take Profit</Badge>
            case 'SL':
                return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3"/>Stop Loss</Badge>
        }
    }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Unrealized ROI" 
          value={loading ? <Skeleton className="h-8 w-24" /> : `${data?.totalRoi.toFixed(2)}%`}
          subtext={`From ${data?.activeSignals ?? 0} active signals`}
          icon={TrendingUp}
          isLoading={loading}
        />
         <StatsCard 
          title="Win Rate" 
          value={data?.winRate === 0 && data?.totalClosedSignals === 0 ? "N/A" : `${data?.winRate.toFixed(1)}%`}
          subtext={loading ? '...' : `Based on ${data?.totalClosedSignals} closed signals`}
          icon={Activity}
          isLoading={loading}
        />
         <StatsCard 
          title="Active Signals" 
          value={data?.activeSignals.toString() ?? '0'} 
          subtext="Signals meeting N wallets criteria"
          icon={Signal}
          isLoading={loading}
        />
         <StatsCard 
          title="Tracked Wallets" 
          value={data?.trackedWallets.toString() ?? '0'} 
          subtext="Actively monitored wallets"
          icon={Users}
          isLoading={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Monthly Win Rate from Closed Signals</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? <Skeleton className="h-[300px] w-full"/> : 
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={data?.performanceChartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <RechartsTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Line
                  dataKey="winrate"
                  type="monotone"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{
                    fill: "hsl(var(--chart-1))",
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ChartContainer>
            }
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Signal Outcomes</CardTitle>
            <CardDescription>Based on all open and historical signals</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {loading ? <Skeleton className="h-[300px] w-full"/> :
             <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                    <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5} startAngle={90} endAngle={450}>
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} className="stroke-background focus:outline-none" />
                        ))}
                    </Pie>
                    <Legend />
                </PieChart>
             </ChartContainer>
            }
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Most Active Trading Pairs</CardTitle>
            <CardDescription>Where coordinated activity has appeared most often.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : topPairs.length > 0 ? (
              <ul className="space-y-3">
                {topPairs.map((pair) => (
                  <li
                    key={pair.pair}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 px-4 py-3 transition hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-base font-semibold">
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        {pair.pair}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{pair.signals} coordinated signal{pair.signals === 1 ? '' : 's'} tracked</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {pair.winRate !== null ? `${pair.winRate.toFixed(1)}% win rate` : 'No closed trades'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No trading pairs have enough activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Standout Signals
            </CardTitle>
            <CardDescription>Open signals outperforming their peers.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : standoutSignals.length > 0 ? (
              <ul className="space-y-3">
                {standoutSignals.map((signal) => (
                  <li
                    key={`${signal.pair}-${signal.timestamp}`}
                    className="rounded-xl border border-border/60 bg-background/60 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{signal.pair}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge
                        variant={signal.type === 'SHORT' ? 'destructive' : 'default'}
                        className={cn(
                          'shrink-0',
                          signal.type === 'LONG' && 'bg-green-600 text-white hover:bg-green-600/80'
                        )}
                      >
                        {signal.type}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-green-600">
                      {signal.roi.toFixed(2)}% ROI · ${signal.pnl.toFixed(2)} PnL
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open signals are outperforming right now.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Signals Requiring Attention
            </CardTitle>
            <CardDescription>Open signals that are currently underwater.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : attentionSignals.length > 0 ? (
              <ul className="space-y-3">
                {attentionSignals.map((signal) => (
                  <li
                    key={`${signal.pair}-attention-${signal.timestamp}`}
                    className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{signal.pair}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">
                        {signal.type}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-destructive">
                      {signal.roi.toFixed(2)}% ROI · ${signal.pnl.toFixed(2)} PnL
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">All open signals are holding steady.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>The most recent signals from your tracked wallets.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>PnL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                     <TableCell colSpan={5} className="text-center">Loading signals...</TableCell>
                  </TableRow>
                ) : !data || data.recentSignals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No recent signals.</TableCell>
                  </TableRow>
                ) : (
                  data.recentSignals.map((signal, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{signal.pair}</TableCell>
                      <TableCell>
                         <Badge
                          variant={signal.type === 'SHORT' ? 'destructive' : 'default'}
                          className={cn(
                            'font-semibold',
                            signal.type === 'LONG' && 'bg-green-600 text-white hover:bg-green-600/80'
                          )}
                        >
                          {signal.type}
                        </Badge>
                      </TableCell>
                       <TableCell>{signal.contributingWallets}</TableCell>
                      <TableCell className={signal.pnl >= 0 ? 'text-green-600' : 'text-destructive'}>
                        ${signal.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(signal.status)}
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
