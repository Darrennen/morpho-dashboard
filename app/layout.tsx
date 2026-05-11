import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Morpho Blue Dashboard",
  description: "Monitor your Morpho Blue positions with Slack alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-morpho-dark antialiased">{children}</body>
    </html>
  );
}
