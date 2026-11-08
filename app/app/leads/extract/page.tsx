"use client";

import { useState, useEffect, useCallback } from "react";
import ExtractForm from "@/components/extract-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSonner } from "@/hooks/use-sonner";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function ExtractPage() {
  const supabase = createBrowserClient();
  const toast = useSonner();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/extract", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } else if (res.status !== 401) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Failed to load extraction jobs");
      }
    } catch {
      toast.error("Failed to load extraction jobs");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // While an Apify run is in progress, poll so the finished run is imported.
  useEffect(() => {
    const hasActiveJob = jobs.some(
      (job) => job.status === "queued" || job.status === "running"
    );
    if (!hasActiveJob) return;

    const timer = setInterval(fetchJobs, 8000);
    return () => clearInterval(timer);
  }, [jobs, fetchJobs]);

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      queued: "secondary",
      running: "outline",
      completed: "outline",
      failed: "destructive",
    };
    return <Badge variant={(variants[status] || "outline") as any}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Lead Extract</h1>
        <p className="text-muted-foreground">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Extract</h1>
          <p className="text-muted-foreground">
            Extract B2B leads from Google Maps, websites, and directories.
          </p>
        </div>
        <Button asChild>
          <a href="/app/settings/integrations">
            Connect Apify
          </a>
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Start Extraction</CardTitle>
              <CardDescription>
                Configure your source, niche, location, and lead limits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExtractForm onJobCreated={fetchJobs} />
            </CardContent>
          </Card>
        </div>
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No jobs yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.slice(0, 5).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {job.params?.niche || "N/A"}
                          </div>
                          {job.error && (
                            <div className="text-xs text-destructive max-w-[180px] truncate" title={job.error}>
                              {job.error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{statusBadge(job.status)}</TableCell>
                        <TableCell className="text-sm">{job.result_count ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
