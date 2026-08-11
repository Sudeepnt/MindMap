"use client";

import { ArrowRight, Building2, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const BUSINESSES_KEY = "opscanvas-businesses-v2";

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cached = localStorage.getItem(BUSINESSES_KEY);
      let nextBusinesses: BusinessSummary[] = [defaultBusiness];
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as unknown;
          if (Array.isArray(parsed)) {
            nextBusinesses = parsed.filter((item): item is BusinessSummary => Boolean(
              item && typeof item === "object" && "id" in item && "title" in item && "updated_at" in item,
            ));
          }
        } catch {
          localStorage.removeItem(BUSINESSES_KEY);
        }
      }
      if (!nextBusinesses.some((business) => business.id === defaultBusiness.id)) {
        nextBusinesses.push(defaultBusiness);
      }
      setBusinesses(nextBusinesses);
      localStorage.setItem(BUSINESSES_KEY, JSON.stringify(nextBusinesses));
    }, 0);
    return () => window.clearTimeout(timer);
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
    setCreating(false);
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
