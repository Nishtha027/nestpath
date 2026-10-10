import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in or create an account · NestPath",
  description: "Log in to NestPath, create an account, or join your family with an invite code.",
};

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}
