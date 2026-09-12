import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Quicksand } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WhimsyCal",
  description: "Turning whims into plans.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col selection:bg-peach selection:text-peach-dark">{children}</body>
    </html>
  );
}
