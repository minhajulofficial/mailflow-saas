"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Reply {
  id: string;
  from_email: string;
  subject: string | null;
  body: string | null;
  received_at: string | null;
  label: string | null;
  leads?: { person_name: string | null; company: string | null; email: string | null } | null;
}

export default function InboxPage() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReplies();
  }, []);

  async function fetchReplies() {
    try {
      const res = await fetch("/api/replies", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setReplies(Array.isArray(data) ? data : []);
      }
    } catch {
      /* keep existing list on network failure */
    }
    setLoading(false);
  }

  const labelBadge = (label: string | null) => {
    if (!label) return <Badge variant="outline">-</Badge>;
    const variants: Record<string, string> = {
      interested: "outline",
      "not interested": "secondary",
      "out of office": "outline",
      "wrong person": "destructive",
    };
    return <Badge variant={(variants[label] || "outline") as any}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            All replies from your campaigns in one place.
          </p>
        </div>
      </div>

      {replies.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground text-sm">No replies yet.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Replies from your campaigns will appear here.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replies.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.from_email}</TableCell>
                <TableCell>{r.subject || "(no subject)"}</TableCell>
                <TableCell>
                  {r.leads?.person_name || "Unknown"} ({r.leads?.email || "-"})
                </TableCell>
                <TableCell>{labelBadge(r.label)}</TableCell>
                <TableCell>
                  {r.received_at
                    ? new Date(r.received_at).toLocaleDateString()
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
