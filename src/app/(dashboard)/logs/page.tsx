
'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLogs, clearLogs, LogEntry } from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle, Info, Search, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const levelConfig = {
    ERROR: { icon: AlertCircle, color: 'text-destructive', badgeVariant: 'destructive' },
    WARN: { icon: TriangleAlert, color: 'text-yellow-500', badgeVariant: 'secondary' },
    INFO: { icon: Info, color: 'text-blue-500', badgeVariant: 'default' },
};

export default function LogsPage() {
    const [logs, setLogs] = React.useState<LogEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedLevels, setSelectedLevels] = React.useState<Set<string>>(new Set(['ERROR', 'WARN', 'INFO']));
    const { toast } = useToast();

    const fetchLogs = React.useCallback(async () => {
        try {
            const fetchedLogs = await getLogs();
            setLogs(fetchedLogs);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to fetch logs.',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleClearLogs = async () => {
        if (!confirm('Are you sure you want to delete all logs? This action cannot be undone.')) {
            return;
        }
        try {
            await clearLogs();
            setLogs([]);
            toast({
                title: 'Success',
                description: 'All logs have been cleared.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to clear logs.',
            });
        }
    };

    const handleLevelToggle = (level: string) => {
        setSelectedLevels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(level)) {
                newSet.delete(level);
            } else {
                newSet.add(level);
            }
            return newSet;
        });
    };

    const filteredLogs = React.useMemo(() => {
        return logs.filter(log => {
            const searchMatch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (log.context && JSON.stringify(log.context).toLowerCase().includes(searchQuery.toLowerCase()));
            const levelMatch = selectedLevels.has(log.level);
            return searchMatch && levelMatch;
        });
    }, [logs, searchQuery, selectedLevels]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground">
                        View system events and errors.
                    </p>
                </div>
                <Button variant="destructive" onClick={handleClearLogs}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Logs
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between">
                         <CardTitle>Log Entries</CardTitle>
                         <div className="flex gap-2">
                             <div className="relative w-full sm:w-64">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="search"
                                placeholder="Search logs..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">Level ({selectedLevels.size})</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Filter by Level</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {Object.keys(levelConfig).map(level => (
                                        <DropdownMenuCheckboxItem
                                            key={level}
                                            checked={selectedLevels.has(level)}
                                            onCheckedChange={() => handleLevelToggle(level)}
                                        >
                                            {level}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Level</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead className="w-[200px]">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        {logs.length === 0 ? 'No logs recorded yet.' : 'No logs match your current filters.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log, index) => {
                                    const Icon = levelConfig[log.level]?.icon || Info;
                                    const color = levelConfig[log.level]?.color || 'text-foreground';
                                    const variant = levelConfig[log.level]?.badgeVariant as any || 'default';
                                    return (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Badge variant={variant} className="gap-1">
                                                    <Icon className="h-3.5 w-3.5" />
                                                    <span>{log.level}</span>
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p>{log.message}</p>
                                                {log.context && (
                                                    <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded-md overflow-x-auto">
                                                        {JSON.stringify(log.context, null, 2)}
                                                    </pre>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
