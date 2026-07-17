import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS — your assistant, on the line",
  description:
    "Call JARVIS and it handles your email, files, calendar, and documents. Connect your Google account to get started.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased tracking-tightest">{children}</body>
    </html>
  );
}
