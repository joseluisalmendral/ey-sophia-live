import type { Metadata } from "next";
import { Inter, Overpass } from "next/font/google";
import "./globals.css";

// Inter: UI + numbers. `tabular-nums` is applied where counters render.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Overpass: display headings (highest free fidelity to EY Interstate).
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "EY SophIA Live",
  description:
    "Live audience voting for EY SophIA, in collaboration with thePower.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${overpass.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
