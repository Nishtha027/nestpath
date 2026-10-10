import type { Metadata } from "next";
import { Welcome } from "./Welcome";

export const metadata: Metadata = {
  title: "NestPath: baby care for the whole family",
  description: "A shared place for your family to track your baby's care, sleep, feeds, growth and vaccines.",
};

export default function Home() {
  return <Welcome />;
}
