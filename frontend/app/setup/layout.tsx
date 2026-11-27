import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your baby · NestPath",
  description: "Add your baby's name, birth date, gender and a first measurement.",
};

export default function SetupLayout({ children }: LayoutProps<"/setup">) {
  return children;
}
