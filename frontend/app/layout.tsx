import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Footer } from "./ui/Footer";
import { MotionGuard } from "./MotionGuard";
import { PageCurtain } from "./PageCurtain";

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

// Lets the phone's bottom bar reach the screen edge and pad itself clear
// of the home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below adds np-js to <html> before
    // React hydrates, so the class list differs from the server's on purpose.
    <html lang="en" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Scroll reveals only hide content when scripts run (globals.css),
            and the landing intro plays once per tab session (landing/Intro). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "var h=document.documentElement;h.classList.add('np-js');try{if(sessionStorage.getItem('np-intro'))h.classList.add('np-intro-seen')}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <AuthProvider>{children}</AuthProvider>
        <Footer />
        <MotionGuard />
        <PageCurtain />
      </body>
    </html>
  );
}
