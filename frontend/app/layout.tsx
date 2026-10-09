import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Footer } from "./ui/Footer";

// Both are downloaded at build time and served from this app (no request
// to Google at runtime). Only the weights the UI uses are loaded; the
// --font-heading and --font-body tokens in globals.css point at them.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NestPath",
  description: "A companion app for new parents",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <AuthProvider>{children}</AuthProvider>
        <Footer />
      </body>
    </html>
  );
}
