export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">You&apos;ve been unsubscribed</h1>
        <p className="text-muted-foreground mt-2">
          You will no longer receive emails from this campaign.
        </p>
      </div>
    </div>
  );
}
