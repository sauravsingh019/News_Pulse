import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News Pulse — Topic-Clustered News Timeline",
  description: "Live topic clusters from multiple news sources, plotted as a timeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
