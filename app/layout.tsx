import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bingo Draft",
  description: "Draft your squares, build your board.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
