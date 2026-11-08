"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSonner } from "@/hooks/use-sonner";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createBrowserClient();
  const toast = useSonner();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/app");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirectTo");
    if (r) setRedirectTo(r);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      toast.success("Logged in successfully");
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      toast.success("Account created! Please verify your email.");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email profile",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Google login failed");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      if (!res.ok) throw new Error("Failed to send reset email");
      toast.success("Password reset email sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-md shadow-xl border-none bg-card text-card-foreground">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">
            {mode === "login" ? "Welcome back" : "Create account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in to your MailFlow account"
              : "Join MailFlow to start extracting leads and sending campaigns"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <div className="flex items-center justify-between text-sm">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  placeholder="John Doe"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="name@company.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating account..." : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By creating an account, you agree to our{" "}
                <a href="/terms" className="text-primary hover:underline">
                  Terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>.
              </p>
            </form>
          )}

          <Separator className="my-6">
            <span className="px-2 bg-background text-xs text-muted-foreground">
              Or continue with
            </span>
          </Separator>

          <Button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              className="mr-2"
            >
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s0-.14.01-.21V7.07h2.57v1.61c0 1.07.68 1.91 1.66 2.23.92.29 1.93.46 2.97.46 1.01 0 1.95-.21 2.79-.59v3.08h-3.57c-.52.39-1.15.62-1.83.62-.62 0-1.2-.16-1.72-.46v2.73H2.18c1.14-1.79 2.82-2.95 3.66-3.63M12 5.38c1.62 0 3.06.69 4.06 1.78l3.15-3.15C16.11 1.5 13.45 2 12 2c-3.87 0-7 3.13-7 7s3.13 7 7 7c1.15 0 2.22-.2 3.19-.54l-2.94-2.51c-.96.39-2.02.62-3.16.62-2.04 0-3.85-1.33-4.5-3.26H2.18C2.86 16.1 5.98 19.34 12 19.34c4.97 0 9-4.02 9-9s-4.03-9-9-9" />
              <path fill="#EA4335" d="M12 19.34c-2.97 0-5.46-.98-7.28-2.66l3.57-2.77c.87-.66 1.43-1.74 1.43-2.86s-.56-2.2-1.43-2.86L4.72 11.2C2.9 14.23 2 16.8 2 19.34 2 22.03 4.23 24 6.92 24h7.16c3.87 0 7-3.13 7-7s-3.13-7-7-7c-2.85 0-5.33 1.49-6.63 3.68l-2.65-2.29C7.64 13.31 9.64 12 12 12c2.21 0 4.19 1.12 5.42 2.88l2.61-2.24C18.43 7.79 15.99 5.38 12 5.38c-2.97 0-5.46.98-7.28 2.66l-3.57 2.77c-.87.66-1.43 1.74 1.43 2.86l3.57 2.77c1.82-1.68 4.31-2.66 7.28-2.66 4.03 0 7.31 3.27 7.31 7.31s-3.28 7.31-7.31 7.31" />
            </svg>
            Continue with Google
          </Button>

          <div className="text-center text-sm">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setMode("signup")}
                >
                  Create account
                </Button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </Button>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-muted-foreground">
            MailFlow - Secure lead extraction &amp; cold email outreach
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
