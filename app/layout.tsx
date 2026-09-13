import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Two-font hierarchy: Inter (a Google Sans stand-in — the real thing isn't a
// public web font) does essentially all UI text — nav, buttons, dates,
// times, descriptions, forms, and calendar items (bumped to semibold/bold
// for emphasis rather than swapping typeface). Fraunces, a serif with real
// personality, is reserved for the app name, major headings, and empty
// states — plus occasional italic for tiny whimsical moments — so it never
// becomes the everyday reading font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "WhimsyCal",
  description: "Turning whims into plans.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col selection:bg-peach selection:text-peach-dark">{children}</body>
    </html>
  );
}
