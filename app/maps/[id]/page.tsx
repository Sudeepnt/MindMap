import { BusinessMap } from "@/components/business-map";

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const title = query.title ?? "Untitled business";

  return <BusinessMap mapId={id} mapTitle={title} />;
}
