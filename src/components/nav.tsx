
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Home,
  Settings,
  Signal,
  Wallet,
  Compass,
  FileText,
  BrainCircuit,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home, description: 'Overview & analytics' },
  { href: '/signals', label: 'Signals', icon: Signal, description: 'Trading signals', badge: 'Live' },
  { href: '/wallets', label: 'Wallets', icon: Wallet, description: 'Manage wallets' },
  { href: '/performance', label: 'Performance', icon: BarChart2, description: 'Trading metrics' },
  { href: '/explorer', label: 'Explorer', icon: Compass, description: 'Market explorer' },
  { href: '/filtered-sw', label: 'Predictor', icon: BrainCircuit, description: 'Smart predictions' },
  { href: '/settings', label: 'Settings', icon: Settings, description: 'Configuration' },
  { href: '/logs', label: 'Logs', icon: FileText, description: 'System logs' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-1 p-2">
      {navItems.map((item) => {
        const isActive =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <SidebarMenuItem key={item.label}>
            <Link href={item.href}>
              <SidebarMenuButton
                asChild
                size="lg"
                isActive={isActive}
                tooltip={{ 
                  children: (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </div>
                  ), 
                  className: "text-sm", 
                  side: "right" 
                }}
                className="h-12 transition-all hover:bg-accent/50"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      {item.badge && (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                  </div>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
