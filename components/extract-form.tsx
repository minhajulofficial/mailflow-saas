"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ExtractForm() {
  const [form, setForm] = useState({
    sourceType: "google-maps",
    niche: "",
    country: "",
    city: "",
    urls: "",
    maxLeads: 100,
    saveList: "Default List",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Extraction job created: ${data.jobId}`);
    } else {
      alert("Failed to start extraction");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Source Type</Label>
          <Select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}>
            <option value="google-maps">Google Maps</option>
            <option value="website-list">Website URL List</option>
            <option value="directory">Directory URL</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Niche / Keyword</Label>
          <Input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="e.g. dentist" />
        </div>
        <div className="space-y-1">
          <Label>Country</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. United States" />
        </div>
        <div className="space-y-1">
          <Label>City / Area</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Optional" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Website URLs (one per line)</Label>
        <Textarea value={form.urls} onChange={(e) => setForm({ ...form, urls: e.target.value })} placeholder="https://example.com\nhttps://example2.com" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Max Leads</Label>
          <Input type="number" value={form.maxLeads} onChange={(e) => setForm({ ...form, maxLeads: parseInt(e.target.value) || 100 })} />
        </div>
        <div className="space-y-1">
          <Label>Save Into List</Label>
          <Input value={form.saveList} onChange={(e) => setForm({ ...form, saveList: e.target.value })} />
        </div>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground">
        Start Extraction
      </Button>
    </form>
  );
}
