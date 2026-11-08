"use client";

import { useEffect, useState } from "react";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  is_ai: boolean;
  created_at: string;
}

const TEMPLATE_HELP_TEXT = "Create and manage email templates. Use {{first_name}}, {{company}} variables.";

export default function TemplatesPage() {
  const toast = useSonner();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    isAi: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    const res = await fetch("/api/templates", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data || []);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.bodyHtml.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          bodyHtml: form.bodyHtml,
          isAi: form.isAi,
        }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      setForm({ name: "", subject: "", bodyHtml: "", isAi: false });
      fetchTemplates();
      toast.success("Template created");
    } catch {
      toast.error("Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-muted-foreground">{TEMPLATE_HELP_TEXT}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Template</CardTitle>
          <CardDescription>Create a new email template for your campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cold Outreach Intro"
              />
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Quick question about {{company}}"
              />
            </div>
            <div className="space-y-1">
              <Label>Body (HTML)</Label>
              <Textarea
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                placeholder="Hi {{first_name}},..."
                className="h-48 font-mono text-sm"
              />
            </div>
            <div className="space-y-1 flex items-start">
              <input
                type="checkbox"
                checked={form.isAi}
                onChange={(e) =>
                  setForm({ ...form, isAi: e.target.checked })
                }
                className="mt-1 h-4 w-4"
              />
              <Label>AI-generated</Label>
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create Template"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template Library</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No templates yet. Create your first template above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.subject}</TableCell>
                    <TableCell>
                      <Badge variant={t.is_ai ? "secondary" : "outline"}>
                        {t.is_ai ? "AI" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
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
