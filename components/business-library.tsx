"use client";

import { ArrowRight, Building2, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

type ConnectionState = "connecting" | "synced" | "offline" | "setup" | "error";

type BusinessSummary = {
  id: string;
  title: string;
  updated_at: string;
};

const defaultBusiness: BusinessSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Digital Marketing Agency",
  updated_at: new Date(0).toISOString(),
};

function connectionError(code?: string): ConnectionState {
  if (!navigator.onLine) return "offline";
  return code === "PGRST205" || code === "PGRST202" || code === "42703" ? "setup" : "error";
}

function connectionLabel(connection: ConnectionState) {
  if (connection === "synced") return "Saved online";
  if (connection === "offline") return "No internet";
  if (connection === "setup") return "Database setup required";
  if (connection === "error") return "Sync error";
  return "Connecting";
}

export function BusinessLibrary() {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadBusinesses = useEffectEvent(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_maps")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setBusinesses([defaultBusiness]);
      setConnection(connectionError(error.code));
      return;
    }
    setBusinesses(data?.length ? data : [defaultBusiness]);
    setConnection("synced");
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBusinesses(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (connection === "synced" || connection === "connecting") return;
    const timer = window.setInterval(() => void loadBusinesses(), 2_000);
    const markOffline = () => setConnection("offline");
    const reconnect = () => void loadBusinesses();
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", reconnect);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", reconnect);
    };
  }, [connection]);

  const createBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || creating) return;
    setCreating(true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const nextBusiness = { id, title: cleanTitle, updated_at: now };
    const supabase = createClient();
    const { error } = await supabase.from("business_maps").insert(nextBusiness);

    if (error) {
      setConnection(connectionError(error.code));
      setCreating(false);
      return;
    }
    setBusinesses([nextBusiness, ...businesses]);
    setConnection("synced");
    setCreating(false);
    setTitle("");
    setShowCreate(false);
  };

  return (
    <main className="library-shell">
      <header className="library-topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>deepmap.ai</span></div>
        <span className={`sync-state ${connection}`}><i />{connectionLabel(connection)}</span>
      </header>

      <section className="library-content">
        <div className="library-intro">
          <div><span className="library-kicker">Business library</span><h1>Your operating maps.</h1><p>Open a business to study its departments, processes, repeated work and AI opportunities.</p></div>
          <button className="create-business" onClick={() => setShowCreate(true)}><Plus size={17} />New business</button>
        </div>

        <div className="business-grid">
          {businesses.map((business, index) => (
            <Link className="business-card" href={`/maps/${business.id}?title=${encodeURIComponent(business.title)}`} key={business.id}>
              <div className="business-card-top"><span>{String(index + 1).padStart(2, "0")}</span><Building2 size={20} /></div>
              <div><h2>{business.title}</h2><p>Open operating tree</p></div>
              <ArrowRight className="business-arrow" size={20} />
            </Link>
          ))}
          <button className="business-card add-business-card" onClick={() => setShowCreate(true)}><Plus size={25} /><span>Add another business</span></button>
        </div>
      </section>

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form className="create-dialog" onSubmit={createBusiness} onMouseDown={(event) => event.stopPropagation()}>
            <div className="editor-head"><div><span>New operating map</span><h2>Which business are you studying?</h2></div><button type="button" onClick={() => setShowCreate(false)}><X size={18} /></button></div>
            <label>Business name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Northstar Dental Group" maxLength={90} /></label>
            <div className="editor-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" disabled={!title.trim() || creating}>{creating ? "Creating..." : "Create business"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
