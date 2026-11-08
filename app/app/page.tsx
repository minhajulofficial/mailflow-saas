"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSonner } from "@/hooks/use-sonner";

interface DashboardStats {
  leads: number;
  campaigns: number;
  sentEmails: number;
  openRate: number;
}

export default function DashboardPage() {
  const toast = useSonner();
  const [stats, setStats] = useState<DashboardStats>({
    leads: 0,
    campaigns: 0,
    sentEmails: 0,
    openRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [leadsRes, campaignsRes, eventsRes] = await Promise.all([
        fetch("/api/leads?pageSize=1", { headers: { Accept: "application/json" } }),
        fetch("/api/campaigns", { headers: { Accept: "application/json" } }),
        fetch("/api/analytics", { headers: { Accept: "application/json" } }),
      ]);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setStats((prev) => ({ ...prev, leads: leadsData.total || 0 }));
      }

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setStats((prev) => ({ ...prev, campaigns: campaignsData.length || 0 }));
      }

      if (eventsRes.ok) {
        const events = await eventsRes.json();
        const sent = events.filter((e: any) => e.type === "sent").length;
        const opened = events.filter((e: any) => e.type === "open").length;
        setStats((prev) => ({
          ...prev,
          sentEmails: sent,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        }));
      }
    } catch {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back to MailFlow. Here&apos;s your overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary text-primary-foreground">
            New Campaign
          </Button>
          <Button variant="outline">New Extraction</Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse rounded-full h-8 w-8 bg-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Leads"
              value={stats.leads}
              icon="Users"
              trend="+12% this month"
              color="bg-blue-500"
            />
            <StatCard
              title="Active Campaigns"
              value={stats.campaigns}
              icon="Mail"
              trend="+2 this week"
              color="bg-green-500"
            />
            <StatCard
              title="Emails Sent"
              value={stats.sentEmails}
              icon="PaperPlane"
              trend="+5% today"
              color="bg-purple-500"
            />
            <StatCard
              title="Open Rate"
              value={`${stats.openRate}%`}
              icon="Eye"
              trend="Estimated rate"
              color="bg-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest lead extractions and campaigns.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm text-center py-8">
                  No recent activity yet. Start by extracting leads.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                <Button
                  onClick={() => (window.location.href = "/app/leads/extract")}
                  className="w-full text-left"
                >
                  Extract New Leads
                </Button>
                <Button
                  onClick={() => (window.location.href = "/app/mail/campaigns")}
                  className="w-full text-left"
                >
                  Create Campaign
                </Button>
                <Button
                  onClick={() => (window.location.href = "/app/mail/templates")}
                  className="w-full text-left"
                >
                  Create Template
                </Button>
                <Button
                  onClick={() => (window.location.href = "/app/settings/integrations")}
                  className="w-full text-left"
                >
                  Connect Integrations
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  color,
  icon,
}: {
  title: string;
  value: number | string;
  trend: string;
  color: string;
  icon: string;
}) {
  const icons: Record<string, JSX.Element> = {
    Users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
    ),
    Mail: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
    ),
    PaperPlane: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
    ),
    Eye: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
    ),
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription className="text-xs">{trend}</CardDescription>
        </div>
        <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center text-white`}>
          {icons[icon]}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
