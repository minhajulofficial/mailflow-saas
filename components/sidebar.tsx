"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <Link href="/app" className="text-xl font-bold tracking-tight">
          MailFlow
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
            )}
          >
            {item.icon} {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        {user?.email && (
          <div className="flex items-center gap-3">
            <span className="text-sm truncate">{user.email}</span>
            <Badge variant="outline">{user.user_metadata?.plan || "free"}</Badge>
          </div>
        )}
        <Button variant="destructive" size="sm" className="w-full mt-3" onClick={() => {}}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
