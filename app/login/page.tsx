"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient();

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email profile",
      },
    });
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-background">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">MailFlow</CardTitle>
          <CardDescription>Extract leads. Send cold emails. Track results.</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Sign in with Google to get started. Your API keys are encrypted and never leave our servers.
          </p>
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
            loading={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" className="mr-2">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s0-.14.01-.21V7.07h2.57v1.61c0 1.07.68 1.91 1.66 2.23.92.29 1.93.46 2.97.46 1.01 0 1.95-.21 2.79-.59v3.08h-3.57c-.52.39-1.15.62-1.83.62-.62 0-1.2-.16-1.72-.46v2.73H2.18c1.14-1.79 2.82-2.95 3.66-3.63M12 5.38c1.62 0 3.06.69 4.06 1.78l3.15-3.15C16.11 1.5 13.45 2 12 2c-3.87 0-7 3.13-7 7s3.13 7 7 7c1.15 0 2.22-.2 3.19-.54l-2.94-2.51c-.96.39-2.02.62-3.16.62-2.04 0-3.85-1.33-4.5-3.26H2.18C2.86 16.1 5.98 19.34 12 19.34c4.97 0 9-4.02 9-9s-4.03-9-9-9"/>
              <path fill="#EA4335" d="M12 19.34c-2.97 0-5.46-.98-7.28-2.66l3.57-2.77c.87-.66 1.43-1.74 1.43-2.86s-.56-2.2-1.43-2.86L4.72 11.2C2.9 14.23 2 16.8 2 19.34 2 22.03 4.23 24 6.92 24h7.16c3.87 0 7-3.13 7-7s-3.13-7-7-7c-2.85 0-5.33 1.49-6.63 3.68l-2.65-2.29C7.64 13.31 9.64 12 12 12c2.21 0 4.19 1.12 5.42 2.88l2.61-2.24C18.43 7.79 15.99 5.38 12 5.38c-2.97 0-5.46.98-7.28 2.66l-3.57 2.77c-.87.66-1.43 1.74-1.43 2.86s.56 2.2 1.43 2.86l3.57 2.77c1.82-1.68 4.31-2.66 7.28-2.66 4.03 0 7.31 3.27 7.31 7.31s-3.28 7.31-7.31 7.31"/>
            </svg>
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
