"use client";

import { useCallback, useEffect, useState } from "react";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LeadRow {
  id: string;
  person_name: string | null;
  company: string | null;
  email: string | null;
  email_status: string | null;
  status: string | null;
  country: string | null;
  city: string | null;
  collected_at: string | null;
  tags: string[];
}

export default function LeadsPage() {
  const toast = useSonner();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", "1");
    params.set("pageSize", "100");

    try {
      const res = await fetch(`/api/leads?${params}`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not load leads");
      }
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error(err?.message || "Could not load leads");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("pageSize", "10000");

    const res = await fetch(`/api/leads/export?${params}`, {
      headers: { Accept: "text/csv" },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mailflow-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Leads exported to CSV");
    } else {
      toast.error("Export failed");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage your extracted B2B leads.
          </p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label htmlFor="lead-search">Search</Label>
          <Input
            id="lead-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-status">Status</Label>
          <Select
            id="lead-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {["new", "contacted", "replied", "interested", "won", "lost"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads ({total})</CardTitle>
          <CardDescription>Your extracted leads. Export to CSV or add to campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              No leads yet. Go to{" "}
              <a href="/app/leads/extract" className="font-medium text-primary hover:underline">
                Lead Extract
              </a>
              to extract some.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Email Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.person_name || "N/A"}</TableCell>
                    <TableCell>{lead.company || "N/A"}</TableCell>
                    <TableCell>{lead.email || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.email_status || "unverified"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.status || "new"}</Badge>
                    </TableCell>
                    <TableCell>
                      {lead.city || ""}, {lead.country || ""}
                    </TableCell>
                    <TableCell>
                      {lead.collected_at
                        ? new Date(lead.collected_at).toLocaleDateString()
                        : "-"}
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
