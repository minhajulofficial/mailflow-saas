import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              M
            </div>
            <span className="text-xl font-bold tracking-tight">MailFlow</span>
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link href="/pricing" className="text-muted-foreground hover:text-primary transition">
              Pricing
            </Link>
            <Link href="/acceptable-use" className="text-muted-foreground hover:text-primary transition">
              Acceptable Use
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-primary transition">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-primary transition">
              Terms
            </Link>
          </div>
          <Button className="bg-primary text-primary-foreground">
            Start free
          </Button>
        </div>
      </nav>

      <section className="relative pt-20 pb-32 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <span className="relative -top-[1px] h-2 w-2 rounded-full bg-primary animate-pulse" />
            BETA — Launch offer: 3 months free on Pro plan
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Extract B2B leads &amp; <br />
            <span className="text-primary">send cold email campaigns</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Find verified business leads from Google Maps and websites, then run
            cold email campaigns with full open, click, and reply tracking — all
            in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="px-8 py-4 text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg rounded-md font-medium text-center">
              Get started free
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 text-lg border border-input hover:bg-accent transition rounded-md font-medium text-center"
            >
              View pricing
            </Link>
          </div>
        </div>

        {/* Decorative grid */}
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000ca0,#000)] pointer-events-none">
          <div className="relative h-full w-full">
            <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need for outreach</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From lead extraction to campaign analytics, MailFlow handles your
              entire outbound workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="Lead Extraction"
              description="Extract leads from Google Maps, websites, and directories with Apify-powered actors."
              icon="Search"
            />
            <FeatureCard
              title="Cold Email Campaigns"
              description="Connect Brevo, Mailjet, or Gmail SMTP and send personalized campaigns with follow-up sequences."
              icon="Mail"
            />
            <FeatureCard
              title="Tracking & Analytics"
              description="Track opens, clicks, replies, and bounces. Visualize performance with real-time dashboards."
              icon="BarChart"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard step="1" title="Connect integrations" description="Add your Apify key and email provider (Brevo, Mailjet, or SMTP). All keys are encrypted at rest." />
            <StepCard step="2" title="Extract leads" description="Search by niche and location. Save leads to lists and export to CSV." />
            <StepCard step="3" title="Launch campaign" description="Pick a template, select leads, and send. Track every open, click, and reply." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-primary p-8 md:p-12 text-primary-foreground text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000,transparent)] opacity-20" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-4">Ready to start outreach?</h2>
              <p className="text-primary/80 mb-8 max-w-lg mx-auto">
                Join hundreds of teams using MailFlow to grow their business.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="px-8 py-3 text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg rounded-md font-medium text-center"
                >
                  Start free with Google
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">M</div>
            <span className="font-semibold">MailFlow</span>
          </div>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-primary transition">Pricing</Link>
            <Link href="/acceptable-use" className="hover:text-primary transition">Acceptable Use</Link>
            <Link href="/privacy" className="hover:text-primary transition">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition">Terms</Link>
          </div>
          <p className="text-xs">© 2026 MailFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  const icons: Record<string, JSX.Element> = {
    Search: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    ),
    Mail: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
    ),
    BarChart: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
    ),
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="space-y-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icons[icon]}</div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          {step}
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
