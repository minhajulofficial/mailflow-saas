"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

interface LeadList {
  id: string;
  name: string;
  lead_count: number;
  email_count: number;
}

export default function LeadsPage() {
  const toast = useSonner();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lists, setLists] = useState<LeadList[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [addForm, setAddForm] = useState({
    person_name: "",
    company: "",
    email: "",
    list_id: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    fetch("/api/lead-lists", { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLists(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_name: addForm.person_name || undefined,
          company: addForm.company || undefined,
          email: addForm.email,
          list_id: addForm.list_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not add lead");
      }
      toast.success("Lead added");
      setAddForm({ person_name: "", company: "", email: "", list_id: "" });
      setShowAdd(false);
      await fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Could not add lead");
    } finally {
      setAdding(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Import failed");
      }
      toast.success(
        `Imported ${data.inserted} lead${data.inserted === 1 ? "" : "s"}` +
          (data.duplicates ? ` · ${data.duplicates} duplicates skipped` : "") +
          (data.invalid ? ` · ${data.invalid} invalid rows` : "")
      );
      await fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
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

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not update lead");
      }
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
      toast.success("Lead updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not update lead");
    }
  };

  const handleDeleteLead = async (id: string, label: string) => {
    if (!window.confirm(`Delete lead "${label}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not delete lead");
      }
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("Lead deleted");
    } catch (err: any) {
      toast.error(err?.message || "Could not delete lead");
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowAdd((value) => !value)}>
            {showAdd ? "Close" : "Add lead"}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            loading={importing}
            disabled={importing}
          >
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
          <Button onClick={handleExport} className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add a lead</CardTitle>
            <CardDescription>
              Add one lead manually. CSV files need an <code>email</code> column.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="lead-email">Email *</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="lead@company.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-name">Person name</Label>
                  <Input
                    id="lead-name"
                    value={addForm.person_name}
                    onChange={(e) => setAddForm({ ...addForm, person_name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input
                    id="lead-company"
                    value={addForm.company}
                    onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                    placeholder="Acme Inc"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-list">List</Label>
                  <Select
                    id="lead-list"
                    value={addForm.list_id}
                    onChange={(e) => setAddForm({ ...addForm, list_id: e.target.value })}
                  >
                    <option value="">No list</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button type="submit" loading={adding} disabled={adding}>
                Add lead
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Actions</TableHead>
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
                      <Select
                        aria-label={`Status for ${lead.email || lead.person_name || "lead"}`}
                        value={lead.status || "new"}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="h-8"
                      >
                        {["new", "contacted", "replied", "interested", "won", "lost"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      {lead.city || ""}, {lead.country || ""}
                    </TableCell>
                    <TableCell>
                      {lead.collected_at
                        ? new Date(lead.collected_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleDeleteLead(
                            lead.id,
                            lead.email || lead.person_name || "this lead"
                          )
                        }
                      >
                        Delete
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
