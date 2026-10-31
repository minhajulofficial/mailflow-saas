export default function IntegrationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect Apify, Brevo, Mailjet, Gmail, or custom SMTP.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Apify</h3>
          <p className="text-sm text-muted-foreground">Lead extraction via Apify actors</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium">Connected</span>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Brevo</h3>
          <p className="text-sm text-muted-foreground">Transactional &amp; marketing email</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium">Connected</span>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Mailjet</h3>
          <p className="text-sm text-muted-foreground">Email sending service</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
