export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground">Sent</div>
          <div className="text-2xl font-bold">0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground">Delivered</div>
          <div className="text-2xl font-bold">0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground">Open Rate</div>
          <div className="text-2xl font-bold">0%</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground">Reply Rate</div>
          <div className="text-2xl font-bold">0%</div>
        </div>
      </div>
      <div className="rounded-lg border p-6 text-muted-foreground">
        Charts and funnel visualization load here.
      </div>
    </div>
  );
}
