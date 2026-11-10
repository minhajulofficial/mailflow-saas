"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

interface SidebarProps {
  user: any;
  /** Desktop: collapsed shows icons only. */
  collapsed?: boolean;
  onToggle?: () => void;
  /** Mobile: drawer open state. */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { name: "Dashboard", href: "/app", icon: "LayoutDashboard" },
  { name: "Lead Extract", href: "/app/leads/extract", icon: "Search" },
  { name: "Leads", href: "/app/leads", icon: "Users" },
  { name: "Campaigns", href: "/app/mail/campaigns", icon: "Mail" },
  { name: "Templates", href: "/app/mail/templates", icon: "FileText" },
  { name: "Inbox", href: "/app/mail/inbox", icon: "Inbox" },
  { name: "Analytics", href: "/app/mail/analytics", icon: "BarChart" },
  { name: "Settings", href: "/app/settings/integrations", icon: "Settings" },
];

function navIcon(icon: string) {
  const common = "h-5 w-5 shrink-0";
  switch (icon) {
    case "LayoutDashboard":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case "Search":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "Users":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    case "Mail":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    case "FileText":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case "Inbox":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
    case "BarChart":
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    default:
      return <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  }
}

export default function Sidebar({
  user,
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  // Labels only hide when collapsed on desktop (lg+); the mobile drawer
  // always shows them because it is only visible below lg.
  const hideLabel = collapsed ? "lg:hidden" : "";

  return (
    <>
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background",
          "transition-[transform,width] duration-200 ease-out",
          // Mobile drawer (below lg): off-canvas unless open.
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          // Desktop collapse.
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/app" className="flex min-w-0 items-center gap-2" aria-label="MailFlow home">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              M
            </div>
            <span className={cn("truncate text-xl font-bold tracking-tight", hideLabel)}>MailFlow</span>
          </Link>
          {/* Collapse toggle: desktop only */}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
            >
              <svg className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
          {/* Close button: mobile drawer only */}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href.startsWith("/app/settings") &&
                pathname.startsWith("/app/settings")) ||
              (item.href !== "/app" &&
                !pathname.startsWith("/app/settings") &&
                pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-0",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                {navIcon(item.icon)}
                <span className={cn("truncate", hideLabel)}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {user?.user_metadata?.full_name?.charAt(0) ||
                user?.email?.charAt(0)?.toUpperCase() ||
                "U"}
            </div>
            <div className={cn("min-w-0 flex-1", hideLabel)}>
              <p className="truncate text-sm font-medium">{user?.email}</p>
              <Badge variant="secondary" className="text-xs">
                {user?.user_metadata?.plan || "Free"}
              </Badge>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className={cn("w-full", collapsed && "lg:px-0")}
            onClick={handleSignOut}
            disabled={!user}
            title={collapsed ? "Sign out" : undefined}
            aria-label={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed ? "lg:hidden" : "ml-2")}>Sign out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
