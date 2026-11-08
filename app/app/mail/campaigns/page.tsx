"use client";

import { useEffect, useState } from "react";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sender_ids: string[];
  created_at: string;
  campaign_steps?: any[];
  sender_accounts?: any[];
}

export default function CampaignsPage() {
  const toast = useSonner();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "" });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    const res = await fetch("/api/campaigns", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data || []);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      setForm({ name: "" });
      fetchCampaigns();
      toast.success("Campaign created");
    } catch {
      toast.error("Failed to create campaign");
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your cold email campaigns.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
          <CardDescription>
            Create a new campaign. You will add recipients, templates, and senders in the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label>Campaign Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="e.g. Q1 Outreach Campaign"
              />
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create Campaign"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
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
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
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
