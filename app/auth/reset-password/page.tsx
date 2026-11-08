"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSonner } from "@/hooks/use-sonner";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const toast = useSonner();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated. You can sign in now.");
    } catch (err: any) {
      const message =
        err?.message || "Could not update password. The link may have expired.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-md shadow-xl border-none bg-card text-card-foreground">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>
            Choose a new password for your MailFlow account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your password has been updated.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                className="w-full"
              >
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-muted-foreground w-full">
            Need a new link?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Return to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
