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

const TITLE = "IA Hackathon · #EYBOOTCAMPFY27";
const DESCRIPTION =
  "Votación en vivo del IA Hackathon del EY Bootcamp FY27, en colaboración con thePower.";

/**
 * Absolute base for the share image URLs (opengraph-image.jpg /
 * twitter-image.jpg next to this layout). Same env precedence as the
 * projector QR; on Vercel without it, the production domain; otherwise Next
 * falls back to the request host.
 */
function siteUrl(): URL | undefined {
  const env = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (env) return new URL(env);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? new URL(`https://${vercel}`) : undefined;
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "IA Hackathon",
    title: TITLE,
    description: "Vota en directo y mira cómo se dispara el marcador en la pantalla grande.",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Vota en directo y mira cómo se dispara el marcador en la pantalla grande.",
  },
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
