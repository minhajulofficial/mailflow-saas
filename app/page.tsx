export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-background">
      <section className="py-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Extract leads. Send cold emails. Close deals.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          MailFlow helps you find B2B leads and run cold email campaigns with full tracking and analytics.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/login" className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition">
            Start free with Google
          </a>
          <a href="/pricing" className="px-8 py-3 border rounded-lg font-semibold hover:bg-accent transition">
            View Pricing
          </a>
        </div>
      </section>
    </div>
  );
}
