"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Stats {
  sent: number;
  delivered: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>({
    sent: 0,
    delivered: 0,
    openRate: 0,
    replyRate: 0,
    bounceRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch("/api/analytics", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const events = await res.json();
        const sent = events.filter((e: any) => e.type === "sent").length;
        const delivered = events.filter((e: any) => e.type === "delivered").length;
        const opened = events.filter((e: any) => e.type === "open").length;
        const replied = events.filter((e: any) => e.type === "reply").length;
        const bounced = events.filter((e: any) => e.type === "bounce").length;

        setStats({
          sent,
          delivered,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
          replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
          bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
        });
      }
    } catch {
      // stats stay at zero
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track campaign performance. Open rates are estimates (Apple MPP may inflate them).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Sent" value={stats.sent} trend="total sent" />
        <StatCard title="Delivered" value={stats.delivered} trend="delivered" />
        <StatCard title="Open Rate" value={`${stats.openRate}%`} trend="estimated" />
        <StatCard title="Reply Rate" value={`${stats.replyRate}%`} trend="replies" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <CardDescription>Sent → Delivered → Opened → Clicked → Replied</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-center items-center">
            <p className="text-muted-foreground text-sm">
              Charts load here once you send campaigns.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-center items-center">
            <p className="text-muted-foreground text-sm">
              Compare campaigns side by side.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        ⚠️ Open rates are estimates due to Apple Mail Privacy Protection. Reply rate is the true measure of success.
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
}: {
  title: string;
  value: string | number;
  trend: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{trend}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
