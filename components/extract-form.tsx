"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ExtractFormProps {
  onJobCreated?: () => void;
}

export default function ExtractForm({ onJobCreated }: ExtractFormProps) {
  const router = useRouter();
  const toast = useSonner();
  const [form, setForm] = useState({
    sourceType: "google-maps",
    niche: "",
    country: "",
    city: "",
    urls: "",
    maxLeads: 100,
    requireEmail: false,
    saveList: "Default List",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.niche.trim()) {
      toast.error("Enter a niche or keyword (e.g. dentist).");
      return;
    }
    if (!form.country.trim()) {
      toast.error("Enter a country (e.g. United States).");
      return;
    }
    if (
      (form.sourceType === "website-list" || form.sourceType === "directory") &&
      !form.urls.trim()
    ) {
      toast.error("Add at least one URL for this source type.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const raw = data?.error;
        const message =
          typeof raw === "string"
            ? raw
            : raw?.fieldErrors
              ? Object.values(raw.fieldErrors).flat()[0]
              : "Failed to start extraction";
        throw new Error(String(message || "Failed to start extraction"));
      }

      toast.success("Extraction job started");
      onJobCreated?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to start extraction");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Source Type</Label>
          <Select
            value={form.sourceType}
            onChange={(e) =>
              setForm({ ...form, sourceType: e.target.value as any })
            }
          >
            <option value="google-maps">Google Maps</option>
            <option value="website-list">Website URL List</option>
            <option value="directory">Directory URL</option>
            <option value="linkedin" disabled>
              LinkedIn (coming soon)
            </option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Niche / Keyword</Label>
          <Input
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            placeholder="e.g. dentist"
          />
        </div>
        <div className="space-y-1">
          <Label>Country</Label>
          <Input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="e.g. United States"
          />
        </div>
        <div className="space-y-1">
          <Label>City / Area</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      {(form.sourceType === "website-list" || form.sourceType === "directory") && (
        <div className="space-y-1">
          <Label>Website URLs (one per line)</Label>
          <Textarea
            value={form.urls}
            onChange={(e) => setForm({ ...form, urls: e.target.value })}
            placeholder="https://example.com\nhttps://example2.com"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Max Leads</Label>
          <Input
            type="number"
            value={form.maxLeads}
            onChange={(e) =>
              setForm({ ...form, maxLeads: parseInt(e.target.value) || 100 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Save Into List</Label>
          <Input
            value={form.saveList}
            onChange={(e) => setForm({ ...form, saveList: e.target.value })}
          />
        </div>
        <div className="space-y-1 flex items-end">
          <Checkbox
            checked={form.requireEmail}
            onChange={(e) =>
              setForm({ ...form, requireEmail: e.target.checked })
            }
          />
          <Label>Require email only</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting} loading={submitting} className="w-full bg-primary text-primary-foreground">
        {submitting ? "Starting extraction..." : "Start Extraction"}
      </Button>
    </form>
  );
}
