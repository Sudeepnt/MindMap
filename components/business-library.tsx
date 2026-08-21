"use client";

import { ArrowRight, Building2, ClipboardPaste, Copy, MoreHorizontal, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

const BUSINESSES_KEY = "opscanvas-businesses-v2";
const BUSINESSES_MIGRATION_KEY = "opscanvas-businesses-cloud-migrated-v1";
const MAP_DRAFT_KEY = "opscanvas-draft-v2";
const MAP_CONNECTIONS_KEY = "opscanvas-connections-v1";
const MAP_VIEWPORT_KEY = "opscanvas-viewport-v2";
const MAP_CLOUD_MIGRATION_KEY = "opscanvas-cloud-migrated-v1";
const MAP_CLIPBOARD_KEY = "opscanvas-map-clipboard-v1";

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

export function BusinessLibrary() {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pastingId, setPastingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedBusiness, setCopiedBusiness] = useState<BusinessSummary | null>(() => {
    if (typeof window === "undefined") return null;
    const cachedClipboard = localStorage.getItem(MAP_CLIPBOARD_KEY);
    if (!cachedClipboard) return null;
    try {
      const parsed = JSON.parse(cachedClipboard) as BusinessSummary;
      return parsed?.id && parsed?.title ? parsed : null;
    } catch {
      localStorage.removeItem(MAP_CLIPBOARD_KEY);
      return null;
    }
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const readLocalBusinesses = () => {
    const cached = localStorage.getItem(BUSINESSES_KEY);
    if (!cached) return [defaultBusiness];
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Invalid business data");
      const valid = parsed.filter((item): item is BusinessSummary => Boolean(
        item && typeof item === "object" && "id" in item && "title" in item && "updated_at" in item,
      ));
      if (!valid.some((business) => business.id === defaultBusiness.id)) valid.push(defaultBusiness);
      return valid;
    } catch {
      localStorage.removeItem(BUSINESSES_KEY);
      return [defaultBusiness];
    }
  };

  const loadBusinesses = useEffectEvent(async () => {
    const localBusinesses = readLocalBusinesses();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_maps")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      setBusinesses(localBusinesses);
      return;
    }
    if (localStorage.getItem(BUSINESSES_MIGRATION_KEY) !== "true") {
      const { error: migrationError } = await supabase.from("business_maps").upsert(localBusinesses);
      if (!migrationError) localStorage.setItem(BUSINESSES_MIGRATION_KEY, "true");
    }
    const cloudBusinesses = data?.length ? data : localBusinesses;
    setBusinesses(cloudBusinesses);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(cloudBusinesses));
    if (copiedBusiness && !cloudBusinesses.some((business) => business.id === copiedBusiness.id)) {
      setCopiedBusiness(null);
      localStorage.removeItem(MAP_CLIPBOARD_KEY);
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBusinesses(), 0);
    const supabase = createClient();
    const channel = supabase
      .channel("business-library")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "business_maps",
      }, () => void loadBusinesses())
      .subscribe();
    const refreshOnFocus = () => void loadBusinesses();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, []);

  const createBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || creating) return;
    setCreating(true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const nextBusiness = { id, title: cleanTitle, updated_at: now };
    const nextBusinesses = [nextBusiness, ...businesses];
    setBusinesses(nextBusinesses);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(nextBusinesses));
    setTitle("");
    setShowCreate(false);
    const { error } = await createClient().from("business_maps").insert(nextBusiness);
    if (error) setBusinesses(businesses);
    setCreating(false);
  };

  const removeLocalMapData = (id: string) => {
    localStorage.removeItem(`${MAP_DRAFT_KEY}:${id}`);
    localStorage.removeItem(`${MAP_CONNECTIONS_KEY}:${id}`);
    localStorage.removeItem(`${MAP_VIEWPORT_KEY}:${id}`);
    localStorage.removeItem(`${MAP_CLOUD_MIGRATION_KEY}:${id}`);
  };

  const deleteBusiness = async (business: BusinessSummary) => {
    if (business.id === defaultBusiness.id || deletingId) return;
    const confirmed = window.confirm(`Delete "${business.title}"? This removes the map and all of its nodes.`);
    if (!confirmed) return;
    const previousBusinesses = businesses;
    const nextBusinesses = businesses.filter((item) => item.id !== business.id);
    setDeletingId(business.id);
    setBusinesses(nextBusinesses);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(nextBusinesses));
    const { error } = await createClient().from("business_maps").delete().eq("id", business.id);
    if (error) {
      setBusinesses(previousBusinesses);
      localStorage.setItem(BUSINESSES_KEY, JSON.stringify(previousBusinesses));
    } else {
      removeLocalMapData(business.id);
      if (copiedBusiness?.id === business.id) {
        setCopiedBusiness(null);
        localStorage.removeItem(MAP_CLIPBOARD_KEY);
      }
    }
    setDeletingId(null);
  };

  const copyBusiness = (business: BusinessSummary) => {
    setCopiedBusiness(business);
    localStorage.setItem(MAP_CLIPBOARD_KEY, JSON.stringify(business));
    setOpenMenuId(null);
    setActionMessage(`Copied "${business.title}". Choose another map and paste it there.`);
  };

  const pasteBusiness = async (target: BusinessSummary) => {
    if (!copiedBusiness || copiedBusiness.id === target.id || pastingId) return;
    setPastingId(target.id);
    setOpenMenuId(null);
    setActionMessage(`Pasting "${copiedBusiness.title}" into "${target.title}"...`);
    const { data, error } = await createClient().rpc("copy_business_map_into", {
      p_source_map_id: copiedBusiness.id,
      p_target_map_id: target.id,
    });
    if (error) {
      setActionMessage(`Could not paste the map. ${error.message}`);
    } else {
      removeLocalMapData(target.id);
      const nodeCount = typeof data === "number" ? data : 0;
      setActionMessage(`Pasted ${nodeCount} nodes from "${copiedBusiness.title}" into "${target.title}".`);
    }
    setPastingId(null);
  };

  return (
    <main className="library-shell">
      <header className="library-topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>deepmap.ai</span></div>
      </header>

      <section className="library-content">
        <div className="library-intro">
          <div><span className="library-kicker">Business library</span><h1>Your operating maps.</h1><p>Open a business to study its departments, processes, repeated work and AI opportunities.</p></div>
          <button className="create-business" onClick={() => setShowCreate(true)}><Plus size={17} />New business</button>
        </div>

        <div className="business-grid">
          {businesses.map((business, index) => (
            <article className="business-card" key={business.id}>
              <Link className="business-card-link" href={`/maps/${business.id}?title=${encodeURIComponent(business.title)}`}>
                <div className="business-card-top"><span>{String(index + 1).padStart(2, "0")}</span><Building2 size={20} /></div>
                <div><h2>{business.title}</h2><p>Open operating tree</p></div>
                <ArrowRight className="business-arrow" size={20} />
              </Link>
              <div className="business-card-menu">
                <button
                  className="business-menu-trigger"
                  onClick={() => setOpenMenuId((current) => current === business.id ? null : business.id)}
                  aria-expanded={openMenuId === business.id}
                  aria-haspopup="menu"
                  title={`Actions for ${business.title}`}
                  aria-label={`Actions for ${business.title}`}
                >
                  <MoreHorizontal size={18} />
                </button>
                {openMenuId === business.id && (
                  <div className="business-menu-popover" role="menu">
                    <button role="menuitem" onClick={() => copyBusiness(business)}>
                      <Copy size={15} />Copy map
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => void pasteBusiness(business)}
                      disabled={!copiedBusiness || copiedBusiness.id === business.id || pastingId !== null}
                    >
                      <ClipboardPaste size={15} />
                      {pastingId === business.id ? "Pasting..." : "Paste here"}
                    </button>
                    {business.id !== defaultBusiness.id && (
                      <button
                        className="danger"
                        role="menuitem"
                        onClick={() => { setOpenMenuId(null); void deleteBusiness(business); }}
                        disabled={deletingId !== null}
                      >
                        <Trash2 size={15} />Delete map
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
          <button className="business-card add-business-card" onClick={() => setShowCreate(true)}><Plus size={25} /><span>Add another business</span></button>
        </div>
        {actionMessage && (
          <div className="library-action-message" role="status">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} aria-label="Dismiss message"><X size={14} /></button>
          </div>
        )}
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
