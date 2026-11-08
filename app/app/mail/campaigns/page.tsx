"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sender_ids: string[];
  created_at: string;
  campaign_steps?: any[];
}

export default function CampaignsPage() {
  const toast = useSonner();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "" });

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns", {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not load campaigns");
      }
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load campaigns");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Enter a campaign name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to create campaign");
      }
      setForm({ name: "" });
      toast.success("Campaign created");
      await fetchCampaigns();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "outline",
      paused: "outline",
      completed: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={(variants[status] || "outline") as any}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">Manage your cold email campaigns.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
          <CardDescription>
            Name it first — then open it to choose a template, sender, and lead list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="e.g. Q1 Outreach Campaign"
              />
            </div>
            <Button type="submit" disabled={creating} loading={creating} className="w-full">
              Create Campaign
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
          <CardDescription>Open a campaign to launch it and watch delivery.</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No campaigns yet. Create your first campaign to start sending.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/mail/campaigns/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.campaign_steps?.[0]?.template_id ? "Configured" : "Not set"}
                    </TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/mail/campaigns/${c.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
