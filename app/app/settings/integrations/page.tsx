"use client";

import { useEffect, useState } from "react";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  enabled: boolean;
  status: string;
  last_tested_at: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: "apify", label: "Apify (Lead Extraction)" },
  { value: "brevo", label: "Brevo (Email Sending)" },
  { value: "mailjet", label: "Mailjet (Email Sending)" },
  { value: "gmail", label: "Gmail SMTP (coming soon)", disabled: true },
  { value: "smtp", label: "Custom SMTP (coming soon)", disabled: true },
];

const SECRET_HINTS: Record<string, string> = {
  apify: "Apify API token (apify_api_...)",
  brevo: "Brevo API key (xkeysib-...)",
  mailjet: "API key:secret key (both, separated by a colon)",
};

export default function IntegrationsPage() {
  const toast = useSonner();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    provider: "apify" as string,
    secret: "",
    label: "",
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    const res = await fetch("/api/integrations", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data || []);
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add integration");
      }
      const data = await res.json();
      if (data.testError) {
        toast.warning(
          `${data.provider} saved, but the connection test failed: ${data.testError}`
        );
      } else {
        toast.success(`${data.provider} connected`);
      }
      setForm({ provider: "apify", secret: "", label: "" });
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message || "Failed to add integration");
    } finally {
      setAdding(false);
    }
  }

  async function handleTest(id: string) {
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Test failed");
      if (data.ok) {
        toast.success("Connection test passed");
      } else {
        toast.error(data.error || "Connection test failed");
      }
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err?.message || "Connection test failed");
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Remove this integration?")) return;
    try {
      const res = await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Integration removed");
      fetchIntegrations();
    } catch {
      toast.error("Failed to remove integration");
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      connected: "outline",
      pending: "secondary",
      error: "destructive",
    };
    return <Badge variant={(variants[status] || "outline") as any}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect Apify, Brevo, Mailjet, Gmail, or custom SMTP. All API keys are encrypted at rest.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Integration</CardTitle>
          <CardDescription>
            Enter your API key. It will be encrypted and stored server-side only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                >
                  <option value="">Select provider</option>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value} disabled={(p as any).disabled}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>API Key / Secret</Label>
                <Input
                  type="password"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  placeholder={SECRET_HINTS[form.provider] || "Enter API key"}
                />
              </div>
              <div className="space-y-1">
                <Label>Label (optional)</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. My Apify Key"
                />
              </div>
            </div>
            <Button type="submit" disabled={adding} className="w-full">
              {adding ? "Testing and saving..." : "Add Integration"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No integrations yet. Add your first one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Tested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>{integration.provider}</TableCell>
                    <TableCell>{integration.label || "-"}</TableCell>
                    <TableCell>{statusBadge(integration.status)}</TableCell>
                    <TableCell>
                      {integration.last_tested_at
                        ? new Date(integration.last_tested_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest(integration.id)}
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemove(integration.id)}
                        >
                          Remove
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

      <div className="text-sm text-muted-foreground">
        🔒 API keys are encrypted with AES-256-GCM and never returned to the browser in plaintext.
      </div>
    </div>
  );
}
