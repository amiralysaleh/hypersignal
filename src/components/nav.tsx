
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
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/signals', label: 'Signals', icon: Signal },
  { href: '/wallets', label: 'Wallets', icon: Wallet },
  { href: '/performance', label: 'Performance', icon: BarChart2 },
  { href: '/explorer', label: 'Explorer', icon: Compass },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/logs', label: 'Logs', icon: FileText },
];

export function Nav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu className="gap-2 p-3">
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
                tooltip={{ children: item.label, className: 'text-sm' }}
                className="group relative overflow-hidden border border-transparent bg-sidebar/40 transition-all duration-200 hover:border-sidebar-primary/40 hover:bg-sidebar-accent/70 data-[active=true]:border-sidebar-primary/60 data-[active=true]:bg-sidebar-primary/15 data-[active=true]:shadow-sm"
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-foreground transition-colors duration-200 group-data-[active=true]:bg-sidebar-primary/20 group-hover:bg-sidebar-primary/20">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="text-base font-medium">{item.label}</span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
