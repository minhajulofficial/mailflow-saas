import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-2">Pricing</h1>
        <p className="text-muted-foreground mb-10">Simple, transparent pricing.</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold">Free</h3>
            <div className="mt-2 mb-4 text-2xl font-bold">$0</div>
            <p className="text-sm text-muted-foreground mb-6">For individuals getting started</p>
            <ul className="text-left text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 100 leads/month</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 50 emails/day</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 1 sender account</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Google login</li>
            </ul>
            <button className="w-full py-3 rounded-lg font-semibold bg-primary text-primary-foreground">
              Get Started
            </button>
          </div>
          <div className="rounded-lg border border-primary p-6 relative">
            <span className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-bl-lg rounded-tr-lg">Popular</span>
            <h3 className="text-lg font-semibold">Pro</h3>
            <div className="mt-2 mb-4 text-2xl font-bold">$29/mo</div>
            <p className="text-sm text-muted-foreground mb-6">For growing teams</p>
            <ul className="text-left text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 5,000 leads/month</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 500 emails/day</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 5 sender accounts</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> AI templates</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Analytics</li>
            </ul>
            <button className="w-full py-3 rounded-lg font-semibold border">
              Choose Plan
            </button>
          </div>
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold">Agency</h3>
            <div className="mt-2 mb-4 text-2xl font-bold">$99/mo</div>
            <p className="text-sm text-muted-foreground mb-6">For agencies &amp; teams</p>
            <ul className="text-left text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 25,000 leads/month</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 2,000 emails/day</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Unlimited senders</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Team workspaces</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Priority support</li>
            </ul>
            <button className="w-full py-3 rounded-lg font-semibold border">
              Choose Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
