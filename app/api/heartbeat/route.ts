import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || !serviceRoleKey) {
    return Response.json({ ok: false, error: "Heartbeat environment variables are not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: latest, error: readError } = await supabase
    .from("app_heartbeats")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) return Response.json({ ok: false, error: readError.message }, { status: 500 });

  const lastHeartbeat = latest ? new Date(latest.created_at).getTime() : 0;
  if (Date.now() - lastHeartbeat < TWO_DAYS_MS) {
    return Response.json({ ok: true, sent: false, message: "Heartbeat is still fresh." });
  }

  const { error: writeError } = await supabase.from("app_heartbeats").insert({ message: "hi" });
  if (writeError) return Response.json({ ok: false, error: writeError.message }, { status: 500 });

  return Response.json({ ok: true, sent: true, message: "hi" });
}
