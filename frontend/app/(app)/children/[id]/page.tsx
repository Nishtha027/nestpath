import { redirect } from "next/navigation";

// The old single child page; its sections are now tabs.
export default async function ChildPage({ params }: PageProps<"/children/[id]">) {
  const { id } = await params;
  redirect(`/children/${id}/vaccines`);
}
