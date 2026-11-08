"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Counts {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

interface CampaignStat extends Counts {
  id: string;
  name: string;
  status: string;
}

const EMPTY: Counts = { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };

export default function AnalyticsPage() {
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventsRes, campaignsRes] = await Promise.all([
        fetch("/api/analytics", { headers: { Accept: "application/json" } }),
        fetch("/api/campaigns", { headers: { Accept: "application/json" } }),
      ]);

      const events = eventsRes.ok ? await eventsRes.json() : [];
      const list = campaignsRes.ok ? await campaignsRes.json() : [];
      const safeEvents = Array.isArray(events) ? events : [];
      const safeCampaigns = Array.isArray(list) ? list : [];

      const tally = (items: any[]): Counts => {
        const next = { ...EMPTY };
        for (const event of items) {
          if (event.type === "sent") next.sent++;
          else if (event.type === "delivered") next.delivered++;
          else if (event.type === "open") next.opened++;
          else if (event.type === "click") next.clicked++;
          else if (event.type === "reply") next.replied++;
          else if (event.type === "bounce") next.bounced++;
        }
        return next;
      };

      setCounts(tally(safeEvents));

      setCampaigns(
        safeCampaigns.map((campaign: any) => {
          const campaignEvents = safeEvents.filter(
            (event: any) => event.email_jobs?.campaign_id === campaign.id
          );
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            ...tally(campaignEvents),
          };
        })
      );

      if (!eventsRes.ok && !campaignsRes.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const rate = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const funnel = [
    { label: "Sent", value: counts.sent },
    { label: "Delivered", value: counts.delivered },
    { label: "Opened", value: counts.opened },
    { label: "Clicked", value: counts.clicked },
    { label: "Replied", value: counts.replied },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track campaign performance. Open rates are estimates (Apple MPP may inflate them).
          </p>
        </div>
        <Badge variant="outline">Last 1,000 events</Badge>
      </div>

      {failed && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Could not load analytics right now. Check your connection and reload.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Sent" value={counts.sent} trend="total sent" />
        <StatCard title="Delivered" value={counts.delivered} trend={`${rate(counts.delivered, counts.sent)}% of sent`} />
        <StatCard title="Open Rate" value={`${rate(counts.opened, counts.sent)}%`} trend="estimated" />
        <StatCard title="Reply Rate" value={`${rate(counts.replied, counts.sent)}%`} trend="true measure" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <CardDescription>Sent → Delivered → Opened → Clicked → Replied</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((step) => (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="text-muted-foreground">
                    {step.value}
                    {counts.sent > 0 && step.label !== "Sent"
                      ? ` · ${rate(step.value, counts.sent)}%`
                      : ""}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((step.value / funnelMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {counts.sent === 0 && (
              <p className="text-sm text-muted-foreground pt-2">
                No sends yet. Launch a campaign to see the funnel.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign comparison</CardTitle>
            <CardDescription>Performance per campaign.</CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No campaigns yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Open</TableHead>
                    <TableHead>Click</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        <div>{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">{campaign.status}</div>
                      </TableCell>
                      <TableCell>{campaign.sent}</TableCell>
                      <TableCell>{rate(campaign.opened, campaign.sent)}%</TableCell>
                      <TableCell>{rate(campaign.clicked, campaign.sent)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        ⚠️ Open rates are estimates due to Apple Mail Privacy Protection. Reply rate is the true
        measure of success.
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
