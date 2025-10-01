
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
          <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-x-2 inset-y-3 -z-10 rounded-[2rem] border border-border/40 bg-background/85 shadow-[0_30px_120px_-40px_rgb(15_23_42/0.45)] backdrop-blur-sm dark:border-border/20 dark:bg-background/70" />
            <div className="relative flex flex-1 flex-col gap-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
