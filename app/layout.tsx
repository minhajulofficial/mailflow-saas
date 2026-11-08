// CSS variables for dark mode support
import "./globals.css";
import { Toaster } from "sonner";

export const metadata = {
  title: "MailFlow — Lead Extraction & Cold Email Outreach",
  description:
    "Extract B2B leads and send cold email campaigns with tracking and analytics.",
  keywords: ["lead extraction", "cold email", "SaaS", "outreach"],
  openGraph: {
    title: "MailFlow — Lead Extraction & Cold Email Outreach",
    description:
      "Extract B2B leads and send cold email campaigns with tracking and analytics.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
