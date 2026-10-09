import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Footer } from "./ui/Footer";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NestPath",
  description: "A companion app for new parents",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunitoSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <AuthProvider>{children}</AuthProvider>
        <Footer />
      </body>
    </html>
  );
}
