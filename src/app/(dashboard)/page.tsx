
'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, Legend, LineChart, Line } from 'recharts';
import { Activity, CheckCircle, Signal, Users, TrendingUp, XCircle, Clock, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDashboardData, DashboardData } from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchDashboardData, WEBSOCKET_URL } from '@/lib/api';

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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fallback data fetching function
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      setError("Failed to fetch dashboard data. Retrying...");
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket for real-time updates
  const { isConnected, connectionStatus, lastMessage } = useWebSocket({
    url: WEBSOCKET_URL,
    onMessage: (message) => {
      if (message.type === 'dashboard_update') {
        setData(message.data);
        setLastUpdate(new Date());
        setError(null);
        if (loading) setLoading(false);
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      setError('Real-time connection lost. Using fallback polling.');
    }
  });

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (!isConnected) {
      // Initial fetch
      fetchData();
      
      // Set up polling as fallback
      interval = setInterval(fetchData, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, fetchData]);
  
  const pieData = data ? Object.entries(data.signalOutcomes).map(([name, value]) => ({ name, value, fill: pieChartColors[name as keyof typeof pieChartColors] })) : [];
  
  const StatsCard = ({ title, value, subtext, icon: Icon, isLoading }: { title: string, value: string | React.ReactNode, subtext: string, icon: React.ElementType, isLoading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-3/4 mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{subtext}</p>
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

  const ConnectionStatus = () => {
    const getStatusColor = () => {
      switch (connectionStatus) {
        case 'connected': return 'text-green-600';
        case 'connecting': return 'text-yellow-600';
        case 'error': return 'text-red-600';
        default: return 'text-gray-600';
      }
    };

    const getStatusIcon = () => {
      switch (connectionStatus) {
        case 'connected': return <Wifi className="h-4 w-4" />;
        case 'connecting': return <AlertTriangle className="h-4 w-4" />;
        case 'error': return <WifiOff className="h-4 w-4" />;
        default: return <WifiOff className="h-4 w-4" />;
      }
    };

    return (
      <div className={cn("flex items-center gap-2 text-sm", getStatusColor())}>
        {getStatusIcon()}
        <span className="capitalize">{connectionStatus}</span>
        {lastUpdate && (
          <span className="text-muted-foreground ml-2">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Connection Status and Error Alert */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time crypto signals and wallet tracking</p>
        </div>
        <ConnectionStatus />
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 min-h-0">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Monthly Win Rate from Closed Signals</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 pb-4">
            {loading ? <Skeleton className="h-[280px] w-full"/> : 
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
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
        <Card className="lg:col-span-3 min-h-0">
          <CardHeader>
            <CardTitle>Signal Outcomes</CardTitle>
            <CardDescription>Based on all open and historical signals</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pb-4">
            {loading ? <Skeleton className="h-[280px] w-full"/> :
             <ChartContainer config={{}} className="h-[280px] w-full">
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
      
      {/* Recent Signals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>The most recent signals from your tracked wallets.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Pair</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead className="w-[80px] text-center">Wallets</TableHead>
                <TableHead className="w-[100px] text-right">PnL</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
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
                     <TableCell className="text-center">{signal.contributingWallets}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      signal.pnl >= 0 ? 'text-green-600' : 'text-destructive'
                    )}>
                      {signal.pnl >= 0 ? '+' : ''}${signal.pnl.toFixed(2)}
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
