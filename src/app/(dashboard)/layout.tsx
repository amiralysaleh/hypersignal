
import * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Nav } from '@/components/nav';
import { Header } from '@/components/header';
import { Logo } from '@/components/logo';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar
        side="left"
        variant="floating"
        collapsible="icon"
        className="border border-sidebar-border/70 bg-sidebar/80 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/60"
      >
        <SidebarHeader className="space-y-2 p-5">
          <Logo className="text-sidebar-foreground" />
          <p className="text-sm text-sidebar-foreground/65 transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
            Intelligence hub for on-chain coordination.
          </p>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-6">
          <div className="rounded-2xl border border-sidebar-border/60 bg-sidebar/70 p-2 shadow-sm backdrop-blur-sm">
            <Nav />
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <div className="page-shell relative flex flex-1 flex-col">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-[2.5rem] border border-border/50 bg-background/80 shadow-[0_45px_140px_-60px_rgba(15,23,42,0.6)] backdrop-blur dark:border-border/20 dark:bg-background/65"
            />
            <div className="relative flex flex-1 flex-col gap-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
