import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./tokens.css";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
