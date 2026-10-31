export default function ExtractPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Extract</h1>
          <p className="text-muted-foreground">Extract B2B leads from Google Maps, websites, and directories.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Start Extraction</h2>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">
                Lead extraction form loads here. Configure your source, niche, location, and lead limits.
              </p>
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Jobs</h2>
            <div className="text-muted-foreground text-sm">No jobs yet.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
