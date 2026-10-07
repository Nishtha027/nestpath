import { redirect } from "next/navigation";

// The screening moved into the Wellbeing tab.
export default function ScreeningRedirect() {
  redirect("/wellbeing");
}
