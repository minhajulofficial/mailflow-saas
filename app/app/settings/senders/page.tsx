"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Sender {
  id: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  enabled: boolean;
  daily_limit: number;
  hourly_limit: number;
  min_delay: number;
  max_delay: number;
  integrations?: { id: string; provider: string; label: string | null; status: string } | null;
}

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  status: string;
}

const EMPTY_FORM = {
  from_name: "",
  from_email: "",
  reply_to: "",
  signature: "",
  integration_id: "",
  daily_limit: 50,
  hourly_limit: 10,
  min_delay: 30,
  max_delay: 120,
};

export default function SendersPage() {
  const toast = useSonner();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    try {
      const [sRes, iRes] = await Promise.all([
        fetch("/api/sender-accounts", { headers: { Accept: "application/json" } }),
        fetch("/api/integrations", { headers: { Accept: "application/json" } }),
      ]);
      if (sRes.ok) setSenders((await sRes.json().catch(() => null)) || []);
      if (iRes.ok) {
        const all: Integration[] = (await iRes.json().catch(() => null)) || [];
        setIntegrations(all.filter((i) => ["brevo", "mailjet"].includes(i.provider)));
      }
    } catch {
      toast.error("Could not load sender accounts");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.from_name.trim() || !form.from_email.trim()) {
      toast.error("From name and from email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sender-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reply_to: form.reply_to || undefined,
          integration_id: form.integration_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not add sender");
      }
      toast.success("Sender account added");
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not add sender");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(sender: Sender) {
    const res = await fetch("/api/sender-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sender.id, enabled: !sender.enabled }),
    });
    if (res.ok) {
      toast.success(sender.enabled ? "Sender disabled" : "Sender enabled");
      load();
    } else {
      toast.error("Could not update sender");
    }
  }

  async function handleDelete(sender: Sender) {
    if (!window.confirm(`Delete sender ${sender.from_email}?`)) return;
    const res = await fetch(`/api/sender-accounts?id=${sender.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Sender deleted");
      load();
    } else {
      toast.error("Could not delete sender");
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading senders...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Sender Accounts</h2>
        <p className="text-muted-foreground">
          The from-address and limits used when MailFlow sends a campaign. Each sender is linked to a
          Brevo or Mailjet integration.
        </p>
      </div>

      {integrations.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          You have no Brevo/Mailjet integration yet.{" "}
          <Link href="/app/settings/integrations" className="font-medium underline">
            Add one first
          </Link>{" "}
          so this sender can actually send email.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add sender account</CardTitle>
          <CardDescription>Use an address your provider has verified.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="from-name">From name</Label>
                <Input
                  id="from-name"
                  value={form.from_name}
                  onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                  placeholder="e.g. Alex from Acme"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="from-email">From email</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={form.from_email}
                  onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                  placeholder="you@yourdomain.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reply-to">Reply-to (optional)</Label>
                <Input
                  id="reply-to"
                  type="email"
                  value={form.reply_to}
                  onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                  placeholder="replies@yourdomain.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="integration">Sending integration</Label>
                <Select
                  id="integration"
                  value={form.integration_id}
                  onChange={(e) => setForm({ ...form, integration_id: e.target.value })}
                >
                  <option value="">None (cannot send yet)</option>
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.provider} {i.label ? `— ${i.label}` : ""} ({i.status})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="daily-limit">Daily limit</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  min={1}
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hourly-limit">Hourly limit</Label>
                <Input
                  id="hourly-limit"
                  type="number"
                  min={1}
                  value={form.hourly_limit}
                  onChange={(e) => setForm({ ...form, hourly_limit: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="min-delay">Min delay (seconds)</Label>
                <Input
                  id="min-delay"
                  type="number"
                  min={0}
                  value={form.min_delay}
                  onChange={(e) => setForm({ ...form, min_delay: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="max-delay">Max delay (seconds)</Label>
                <Input
                  id="max-delay"
                  type="number"
                  min={0}
                  value={form.max_delay}
                  onChange={(e) => setForm({ ...form, max_delay: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="signature">Signature (optional)</Label>
              <Textarea
                id="signature"
                value={form.signature}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                placeholder="Appended to every email"
                rows={3}
              />
            </div>
            <Button type="submit" loading={saving} disabled={saving}>
              Add sender
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your senders</CardTitle>
        </CardHeader>
        <CardContent>
          {senders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sender accounts yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {senders.map((sender) => (
                  <TableRow key={sender.id}>
                    <TableCell>
                      <div className="font-medium">{sender.from_name}</div>
                      <div className="text-xs text-muted-foreground">{sender.from_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sender.integrations?.provider || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sender.daily_limit}/day · {sender.hourly_limit}/hr · {sender.min_delay}-
                      {sender.max_delay}s
                    </TableCell>
                    <TableCell>
                      <Badge variant={sender.enabled ? "outline" : "secondary"}>
                        {sender.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleEnabled(sender)}>
                          {sender.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(sender)}>
                          Delete
                        </Button>
                      </div>
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
