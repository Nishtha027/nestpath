import { redirect } from "next/navigation";

// Insights now live on the Log page, under the form. Old links, bookmarks
// and "show insights" by voice land there.
export default async function InsightsPage({ params }: PageProps<"/children/[id]/insights">) {
  const { id } = await params;
  redirect(`/children/${id}/log#insights`);
}
