import { createClient } from "@supabase/supabase-js";
import { BusinessMap } from "@/components/business-map";

export const dynamic = "force-dynamic";

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabase.from("business_maps").select("title").eq("id", id).maybeSingle();
  const title = data?.title ?? query.title ?? "Untitled business";

  return <BusinessMap mapId={id} mapTitle={title} />;
}
