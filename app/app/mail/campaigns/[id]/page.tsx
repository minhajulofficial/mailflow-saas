"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  created_at: string;
  steps: any[];
  jobs: any[];
  counts: { total: number; scheduled: number; sent: number; failed: number };
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface Sender {
  id: string;
  from_name: string;
  from_email: string;
  enabled: boolean;
  integrations?: { provider: string } | null;
}

interface LeadList {
  id: string;
  name: string;
  lead_count: number;
  email_count: number;
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useSonner();
  const id = params?.id;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ templateId: "", senderId: "", listId: "" });

  const load = useCallback(async () => {
    if (!id) return;
    const [cRes, tRes, sRes, lRes] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { headers: { Accept: "application/json" } }),
      fetch("/api/templates", { headers: { Accept: "application/json" } }),
      fetch("/api/sender-accounts", { headers: { Accept: "application/json" } }),
      fetch("/api/lead-lists", { headers: { Accept: "application/json" } }),
    ]);

    if (cRes.status === 404) {
      toast.error("Campaign not found");
      router.push("/app/mail/campaigns");
      return;
    }
    if (!cRes.ok) {
      const data = await cRes.json().catch(() => ({}));
      toast.error(data?.error || "Could not load campaign");
      setLoading(false);
      return;
    }

    const detail = await cRes.json();
    setCampaign(detail);

    if (tRes.ok) setTemplates(await tRes.json());
    if (sRes.ok) setSenders(await sRes.json());
    if (lRes.ok) setLists(await lRes.json());

    const stepTemplate = detail?.steps?.[0]?.template_id;
    const firstSender = detail?.sender_ids?.[0];
    setForm((prev) => ({
      templateId: prev.templateId || stepTemplate || "",
      senderId: prev.senderId || firstSender || "",
      listId: prev.listId || detail?.recipient_filter?.listId || "",
    }));

    setLoading(false);
  }, [id, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLaunch() {
    if (!form.templateId) return toast.error("Choose a template");
    if (!form.senderId) return toast.error("Choose a sender account");
    setLaunching(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: form.templateId,
          senderId: form.senderId,
          listId: form.listId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Launch failed");
      toast.success(`${data.queued} email${data.queued === 1 ? "" : "s"} queued`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not launch campaign");
    } finally {
      setLaunching(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send-now`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Send failed");
      if (data.processed === 0) {
        toast.info("Nothing is due yet. Emails are spaced out — try again shortly.");
      } else {
        toast.success(
          `Processed ${data.processed}: ${data.succeeded} sent, ${data.failed} failed`
        );
      }
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not send emails");
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(status: string) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Campaign ${status}`);
      load();
    } else {
      toast.error("Could not update campaign");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this campaign and its queued emails? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Campaign deleted");
      router.push("/app/mail/campaigns");
    } else {
      toast.error("Could not delete campaign");
    }
  }

  const statusBadge = (status: string) => {
    const variant =
      status === "failed" || status === "cancelled"
        ? "destructive"
        : status === "sent" || status === "completed"
          ? "outline"
          : "secondary";
    return <Badge variant={variant as any}>{status}</Badge>;
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="p-6 text-muted-foreground">Campaign not found.</div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/mail/campaigns" className="text-sm text-muted-foreground hover:underline">
            ← All campaigns
          </Link>
          <h1 className="text-2xl font-bold mt-1">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">
            Created {new Date(campaign.created_at).toLocaleString()} · {statusBadge(campaign.status)}
          </p>
        </div>
        <div className="flex gap-2">
          {(campaign.status === "scheduled" || campaign.status === "sending") && (
            <Button variant="outline" onClick={() => handleStatus("paused")}>
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button variant="outline" onClick={() => handleStatus("scheduled")}>
              Resume
            </Button>
          )}
          <Button variant="destructive" onClick={() => handleStatus("cancelled")}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Recipients", campaign.counts.total],
          ["Queued", campaign.counts.scheduled],
          ["Sent", campaign.counts.sent],
          ["Failed", campaign.counts.failed],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set up &amp; launch</CardTitle>
          <CardDescription>
            Pick the template, sender, and lead list. Emails are queued and spaced out based on the
            sender&apos;s delay settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="template">Template</Label>
              <Select
                id="template"
                value={form.templateId}
                onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.subject}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sender">Sender account</Label>
              <Select
                id="sender"
                value={form.senderId}
                onChange={(e) => setForm({ ...form, senderId: e.target.value })}
              >
                <option value="">Select a sender</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.from_name} &lt;{s.from_email}&gt;
                    {s.integrations?.provider ? ` · ${s.integrations.provider}` : " · no provider"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="list">Lead list</Label>
              <Select
                id="list"
                value={form.listId}
                onChange={(e) => setForm({ ...form, listId: e.target.value })}
              >
                <option value="">All leads with email</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.email_count} with email)
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleLaunch} loading={launching} disabled={launching}>
              Queue emails
            </Button>
            <Button variant="outline" onClick={handleSendNow} loading={sending} disabled={sending}>
              Send due emails now
            </Button>
            {templates.length === 0 && (
              <Button asChild variant="ghost">
                <Link href="/app/mail/templates">Create a template first</Link>
              </Button>
            )}
            {senders.length === 0 && (
              <Button asChild variant="ghost">
                <Link href="/app/settings/integrations">Add a sender account first</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sends</CardTitle>
          <CardDescription>Latest 200 email jobs for this campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nothing queued yet. Set up and launch the campaign above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="font-medium">{job.leads?.person_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{job.leads?.email}</div>
                    </TableCell>
                    <TableCell>{statusBadge(job.status)}</TableCell>
                    <TableCell className="text-sm">
                      {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.sent_at ? new Date(job.sent_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[220px] truncate" title={job.error || ""}>
                      {job.error || ""}
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
