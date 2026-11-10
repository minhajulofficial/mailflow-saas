"use client";

import { useCallback, useEffect, useState } from "react";
import { useSonner } from "@/hooks/use-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  sender_address: string | null;
  timezone: string | null;
  plan: string | null;
}

export default function AccountPage() {
  const toast = useSonner();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [form, setForm] = useState({ name: "", sender_address: "", timezone: "UTC" });
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Could not load profile");
      setProfile(data);
      if (data) {
        setForm({
          name: data.name || "",
          sender_address: data.sender_address || "",
          timezone: data.timezone || "UTC",
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not save profile");
      }
      setProfile(data);
      toast.success("Profile saved");
    } catch (err: any) {
      toast.error(err?.message || "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.current.trim()) {
      toast.error("Enter your current password");
      return;
    }
    if (password.next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password.next !== password.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.next, currentPassword: password.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not update password");
      }
      setPassword({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function exportData() {
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mailflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Your data export was downloaded");
    } catch {
      toast.error("Could not export your data");
    }
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    if (!window.confirm("This permanently deletes your account and all data. Continue?")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not delete account");
      }
      toast.success("Account deleted");
      window.location.assign("/login");
    } catch (err: any) {
      toast.error(err?.message || "Could not delete account");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Account</h2>
        <p className="text-muted-foreground">Manage your profile, password, and data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium">{profile?.email}</span> ·{" "}
            {profile?.plan || "free"} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sender-address">Default sender address</Label>
                <Input
                  id="sender-address"
                  type="email"
                  value={form.sender_address}
                  onChange={(e) => setForm({ ...form, sender_address: e.target.value })}
                  placeholder="you@yourdomain.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="e.g. Asia/Dhaka"
                />
              </div>
            </div>
            <Button type="submit" loading={savingProfile} disabled={savingProfile}>
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Confirm your current password, then choose a new one with at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={password.current}
                onChange={(e) => setPassword({ ...password, current: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password.next}
                  onChange={(e) => setPassword({ ...password, next: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" loading={savingPassword} disabled={savingPassword}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data &amp; privacy</CardTitle>
          <CardDescription>
            Download a copy of your data, or permanently delete your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <div>
              <p className="font-medium">Export your data</p>
              <p className="text-sm text-muted-foreground">
                Leads, campaigns, templates, and activity as JSON.
              </p>
            </div>
            <Button variant="outline" onClick={exportData}>
              Download JSON
            </Button>
          </div>

          <div className="rounded-md border border-destructive/40 p-4 space-y-3">
            <div>
              <p className="font-medium text-destructive">Delete account</p>
              <p className="text-sm text-muted-foreground">
                This removes your account and all associated data immediately. This cannot be undone.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <Button
                variant="destructive"
                onClick={deleteAccount}
                loading={deleting}
                disabled={deleting || confirmText !== "DELETE"}
              >
                Delete my account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
