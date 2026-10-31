export default function AccountPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <p className="text-muted-foreground text-sm">Manage your profile and data preferences.</p>
      </div>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Data &amp; Privacy</h2>
        <p className="text-muted-foreground text-sm">Export or delete your account data (GDPR).</p>
      </div>
    </div>
  );
}
