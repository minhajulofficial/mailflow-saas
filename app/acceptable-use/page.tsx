export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-background py-20 px-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Acceptable Use Policy</h1>
      <ul className="list-disc pl-6 text-muted-foreground space-y-2">
        <li>No spam or unsolicited bulk email to personal addresses.</li>
        <li>No fraud or misrepresentation.</li>
        <li>No scraping of personal (Gmail/Yahoo) email addresses.</li>
        <li>Comply with CAN-SPAM, GDPR, and local laws.</li>
      </ul>
    </div>
  );
}
