
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

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/signals', label: 'Signals', icon: Signal },
  { href: '/wallets', label: 'Wallets', icon: Wallet },
  { href: '/performance', label: 'Performance', icon: BarChart2 },
  { href: '/explorer', label: 'Explorer', icon: Compass },
  { href: '/filtered-sw', label: 'Predictor', icon: BrainCircuit },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/logs', label: 'Logs', icon: FileText },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-2 p-2">
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
                tooltip={{ children: item.label, className: "text-sm" }}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="text-base">{item.label}</span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
