export default function InboxPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
      </div>
      <div className="rounded-lg border p-6 text-muted-foreground">
        No replies yet. Replies from your campaigns will appear here.
      </div>
    </div>
  );
}
