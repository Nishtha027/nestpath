import { redirect } from "next/navigation";

// The live care log is now History (same live feed, plus filters and
// editing); old links and bookmarks land there.
export default async function CareLogPage({ params }: PageProps<"/children/[id]/care-log">) {
  const { id } = await params;
  redirect(`/children/${id}/history`);
}
