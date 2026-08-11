"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { MapNode, StoredNode } from "@/lib/types";

const DEFAULT_MAP_ID = "00000000-0000-4000-8000-000000000001";
const STORAGE_KEY = "opscanvas-draft-v1";
const VIEWPORT_KEY = "opscanvas-viewport-v1";
const X_GAP = 330;
const Y_GAP = 150;

const seedNodes: MapNode[] = [
  makeNode("company", null, "Digital Marketing Agency", "Business operating model", 0),
  makeNode("departments", "company", "Departments", "Core functions of the business", 0),
  makeNode("sales", "departments", "Sales", "Turn qualified demand into clients", 0),
  makeNode("marketing", "departments", "Marketing", "Create awareness and demand", 1),
  makeNode("operations", "departments", "Operations", "Deliver work consistently", 2),
  makeNode("finance", "departments", "Finance", "Cash flow, invoicing and reporting", 3),
  makeNode("people", "departments", "People & HR", "Hiring, onboarding and support", 4),
  makeNode("lead-gen", "sales", "Lead Generation", "Find businesses that match the ideal client profile", 0),
  makeNode("qualification", "lead-gen", "Lead Qualification", "Check fit, urgency and available budget", 0),
  makeNode("discovery", "qualification", "Discovery Call", "Understand goals, constraints and current workflow", 0),
  makeNode("reporting", "operations", "Client Reporting", "Compile performance data for clients", 0),
  makeNode("reporting-ai", "reporting", "Automated Report Draft", "Collect metrics and prepare a review-ready narrative", 0, true),
];

function makeNode(
  id: string,
  parentId: string | null,
  heading: string,
  description: string,
  sortOrder: number,
  aiSolution = false,
): MapNode {
  return {
    id,
    type: "businessNode",
    position: { x: 0, y: 0 },
    data: { heading, description, parentId, sortOrder, collapsed: false, aiSolution, repeatedWork: false },
  };
}

function descendantsOf(nodes: MapNode[], id: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    nodes.filter((node) => node.data.parentId === parentId).forEach((child) => {
      result.add(child.id);
      visit(child.id);
    });
  };
  visit(id);
  return result;
}

function layoutTree(nodes: MapNode[]): MapNode[] {
  if (!nodes.length) return nodes;
  const byParent = new Map<string | null, MapNode[]>();
  nodes.forEach((node) => {
    const group = byParent.get(node.data.parentId) ?? [];
    group.push(node);
    byParent.set(node.data.parentId, group);
  });
  byParent.forEach((group) => group.sort((a, b) => a.data.sortOrder - b.data.sortOrder));

  let nextLeafY = 0;
  const positions = new Map<string, { x: number; y: number }>();
  const hidden = new Set<string>();

  const place = (node: MapNode, depth: number): number => {
    const children = byParent.get(node.id) ?? [];
    if (node.data.collapsed) {
      descendantsOf(nodes, node.id).forEach((id) => hidden.add(id));
    }
    const visibleChildren = node.data.collapsed ? [] : children;
    let y: number;
    if (!visibleChildren.length) {
      y = nextLeafY;
      nextLeafY += Y_GAP;
    } else {
      const childYs = visibleChildren.map((child) => place(child, depth + 1));
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }
    positions.set(node.id, { x: depth * X_GAP, y });
    return y;
  };

  (byParent.get(null) ?? []).forEach((root) => place(root, 0));
  const minY = Math.min(...Array.from(positions.values(), (position) => position.y), 0);
  return nodes.map((node) => ({
    ...node,
    hidden: hidden.has(node.id),
    position: positions.has(node.id)
      ? { x: positions.get(node.id)!.x, y: positions.get(node.id)!.y - minY }
      : node.position,
  }));
}

function BusinessNode({ id, data, selected }: NodeProps<MapNode>) {
  return (
    <div className={`map-node ${!data.description ? "is-compact" : ""} ${selected ? "is-selected" : ""} ${data.aiSolution ? "is-ai" : ""} ${data.repeatedWork ? "is-repeated" : ""}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <button
        className="node-collapse nodrag"
        onClick={() => data.onToggle?.(id)}
        aria-label={data.collapsed ? "Expand children" : "Collapse children"}
        hidden={!data.childCount}
      >
        {data.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        {data.collapsed && <span>{data.childCount}</span>}
      </button>
      {data.aiSolution && (
        <span className="ai-badge"><Sparkles size={11} /> AI solution</span>
      )}
      {data.repeatedWork && (
        <span className="repeated-badge"><Redo2 size={11} /> Most repeated work</span>
      )}
      <strong>{data.heading}</strong>
      {data.description && <p>{data.description}</p>}
      <Handle type="source" position={Position.Right} className="node-handle" />
      <button className="add-control add-child nodrag" onClick={() => data.onAddChild?.(id)} aria-label="Add child">
        <Plus size={16} />
        <span>Add child</span>
      </button>
      <button className="add-control add-sibling nodrag" onClick={() => data.onAddSibling?.(id)} aria-label="Add sibling">
        <Plus size={15} />
      </button>
    </div>
  );
}

const nodeTypes = { businessNode: BusinessNode };

type EditorState = { id: string | null; parentId: string | null; heading: string; description: string };
type MenuState = { id: string; x: number; y: number } | null;

export function BusinessMap({ mapId, mapTitle }: { mapId: string; mapTitle: string }) {
  return <ReactFlowProvider><BusinessMapCanvas mapId={mapId} mapTitle={mapTitle} /></ReactFlowProvider>;
}

function BusinessMapCanvas({ mapId, mapTitle }: { mapId: string; mapTitle: string }) {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [connection, setConnection] = useState<"connecting" | "synced" | "local">("connecting");
  const [loaded, setLoaded] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const past = useRef<MapNode[][]>([]);
  const future = useRef<MapNode[][]>([]);
  const flowInstance = useRef<ReactFlowInstance<MapNode, Edge> | null>(null);
  const pendingViewport = useRef<Viewport | null>(null);
  const mapStorageKey = `${STORAGE_KEY}:${mapId}`;
  const mapViewportKey = `${VIEWPORT_KEY}:${mapId}`;

  const hydrateActions = (items: MapNode[]) => items.map((node) => ({
    ...node,
    data: {
      ...node.data,
      childCount: items.filter((candidate) => candidate.data.parentId === node.id).length,
      onAddChild: addChild,
      onAddSibling: addSibling,
      onToggle: toggleCollapsed,
    },
  }));

  const commit = (updater: (current: MapNode[]) => MapNode[], relayout = true) => {
    setNodes((current) => {
      past.current.push(current.map(stripActions));
      if (past.current.length > 60) past.current.shift();
      future.current = [];
      setHistoryState({ canUndo: true, canRedo: false });
      const updated = updater(current).map(stripActions);
      return hydrateActions(relayout ? layoutTree(updated) : updated);
    });
  };

  function addChild(parentId: string) {
    const siblings = nodes.filter((node) => node.data.parentId === parentId);
    setEditor({ id: null, parentId, heading: "", description: "" });
    setMenu(null);
    setSelectedId(parentId);
    pendingSort.current = siblings.length;
  }

  const pendingSort = useRef(0);

  function addSibling(id: string) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    pendingSort.current = nodes.filter((item) => item.data.parentId === node.data.parentId).length;
    setEditor({ id: null, parentId: node.data.parentId, heading: "", description: "" });
    setMenu(null);
  }

  function toggleCollapsed(id: string) {
    commit((current) => current.map((node) => node.id === id
      ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } }
      : node));
  }

  function stripActions(node: MapNode): MapNode {
    const data = { ...node.data };
    delete data.onAddChild;
    delete data.onAddSibling;
    delete data.onToggle;
    delete data.childCount;
    return { ...node, data };
  }

  const loadMap = useEffectEvent(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_map_nodes")
      .select("*")
      .eq("map_id", mapId)
      .order("sort_order");

    let initial: MapNode[];
    let hasSavedPositions = false;
    if (!error && data?.length) {
      initial = (data as StoredNode[]).map((item) => ({
        id: item.id,
        type: "businessNode",
        position: { x: item.position_x, y: item.position_y },
        data: {
          heading: item.heading,
          description: item.description ?? "",
          parentId: item.parent_id,
          sortOrder: item.sort_order,
          collapsed: item.collapsed,
          aiSolution: item.ai_solution,
          repeatedWork: item.repeated_work ?? false,
        },
      }));
      hasSavedPositions = true;
      setConnection("synced");
    } else {
      const legacyDraft = mapId === DEFAULT_MAP_ID ? localStorage.getItem(STORAGE_KEY) : null;
      const cached = localStorage.getItem(mapStorageKey) ?? legacyDraft;
      initial = cached
        ? JSON.parse(cached)
        : mapId === DEFAULT_MAP_ID
          ? seedNodes.map((node) => node.id === "company" ? { ...node, data: { ...node.data, heading: mapTitle } } : node)
          : [makeNode(`root-${mapId}`, null, mapTitle, "Business operating model", 0)];
      hasSavedPositions = Boolean(cached);
      setConnection("local");
    }
    const positioned = hasSavedPositions ? initial.map(stripActions) : layoutTree(initial.map(stripActions));
    setNodes(hydrateActions(positioned));
    setLoaded(true);

    const legacyViewport = mapId === DEFAULT_MAP_ID ? localStorage.getItem(VIEWPORT_KEY) : null;
    const savedViewport = localStorage.getItem(mapViewportKey) ?? legacyViewport;
    pendingViewport.current = savedViewport ? JSON.parse(savedViewport) as Viewport : null;
    window.setTimeout(() => {
      if (!flowInstance.current) return;
      if (pendingViewport.current) void flowInstance.current.setViewport(pendingViewport.current);
      else void flowInstance.current.fitView({ padding: 0.25 });
    }, 0);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMap(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveMap = useEffectEvent(async (current: MapNode[]) => {
    const clean = current.map(stripActions);
    localStorage.setItem(mapStorageKey, JSON.stringify(clean));
    const supabase = createClient();
    const rows = clean.map((node) => ({
      id: node.id,
      map_id: mapId,
      parent_id: node.data.parentId,
      heading: node.data.heading,
      description: node.data.description,
      sort_order: node.data.sortOrder,
      position_x: node.position.x,
      position_y: node.position.y,
      collapsed: node.data.collapsed,
      ai_solution: node.data.aiSolution,
      repeated_work: node.data.repeatedWork ?? false,
    }));
    const { error } = await supabase.from("business_map_nodes").upsert(rows);
    if (error) { setConnection("local"); return; }
    const ids = rows.map((row) => row.id);
    const { data: remote } = await supabase.from("business_map_nodes").select("id").eq("map_id", mapId);
    const removed = (remote ?? []).filter((row) => !ids.includes(row.id)).map((row) => row.id);
    if (removed.length) await supabase.from("business_map_nodes").delete().in("id", removed);
    await supabase.from("business_maps").update({ updated_at: new Date().toISOString() }).eq("id", mapId);
    setConnection("synced");
  });

  useEffect(() => {
    if (!loaded || !nodes.length) return;
    const timer = window.setTimeout(() => void saveMap(nodes), 500);
    return () => window.clearTimeout(timer);
  }, [nodes, loaded]);

  const edges: Edge[] = nodes
    .filter((node) => node.data.parentId && !node.hidden)
    .map((node) => ({
      id: `edge-${node.data.parentId}-${node.id}`,
      source: node.data.parentId!,
      target: node.id,
      type: "smoothstep",
      style: { stroke: node.data.aiSolution ? "#0f766e" : "#a9a8a2", strokeWidth: 1.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: node.data.aiSolution ? "#0f766e" : "#a9a8a2", width: 14, height: 14 },
    }));

  const onNodesChange = (changes: NodeChange<MapNode>[]) => {
    setNodes((current) => hydrateActions(applyNodeChanges(changes, current)));
  };

  const deleteNode = (id: string) => {
    const descendants = descendantsOf(nodes, id);
    commit((current) => current.filter((node) => node.id !== id && !descendants.has(node.id)));
    setSelectedId(null);
    setMenu(null);
  };

  const duplicateNode = (id: string) => {
    const source = nodes.find((node) => node.id === id);
    if (!source) return;
    const idCopy = crypto.randomUUID();
    const sortOrder = nodes.filter((node) => node.data.parentId === source.data.parentId).length;
    commit((current) => [...current, makeNode(idCopy, source.data.parentId, `${source.data.heading} copy`, source.data.description, sortOrder, source.data.aiSolution)]);
    setSelectedId(idCopy);
    setMenu(null);
  };

  const toggleAi = (id: string) => {
    commit((current) => current.map((node) => node.id === id
      ? { ...node, data: { ...node.data, aiSolution: !node.data.aiSolution } }
      : node));
    setMenu(null);
  };

  const toggleRepeatedWork = (id: string) => {
    commit((current) => current.map((node) => node.id === id
      ? { ...node, data: { ...node.data, repeatedWork: !node.data.repeatedWork } }
      : node));
    setMenu(null);
  };

  const editNode = (id: string) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    setEditor({ id, parentId: node.data.parentId, heading: node.data.heading, description: node.data.description });
    setMenu(null);
  };

  const saveEditor = () => {
    if (!editor?.heading.trim()) return;
    if (editor.id) {
      commit((current) => current.map((node) => node.id === editor.id
        ? { ...node, data: { ...node.data, heading: editor.heading.trim(), description: editor.description.trim() } }
        : node), false);
    } else {
      const id = crypto.randomUUID();
      commit((current) => [...current, makeNode(id, editor.parentId, editor.heading.trim(), editor.description.trim(), pendingSort.current)]);
      setSelectedId(id);
    }
    setEditor(null);
  };

  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    setNodes((current) => {
      future.current.push(current.map(stripActions));
      setHistoryState({ canUndo: past.current.length > 0, canRedo: true });
      return hydrateActions(previous);
    });
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    setNodes((current) => {
      past.current.push(current.map(stripActions));
      setHistoryState({ canUndo: true, canRedo: future.current.length > 0 });
      return hydrateActions(next);
    });
  };

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea")) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (command && event.key.toLowerCase() === "d" && selectedId) {
      event.preventDefault();
      duplicateNode(selectedId);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
      event.preventDefault();
      deleteNode(selectedId);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const menuNode = menu ? nodes.find((node) => node.id === menu.id) : null;

  return (
    <main className="app-shell" onClick={() => setMenu(null)}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>OpsCanvas</span></div>
        <div className="map-title"><Link href="/"><ArrowLeft size={14} />All businesses</Link><ChevronRight size={14} /><strong>{mapTitle}</strong></div>
        <div className="top-actions">
          <button onClick={(event) => { event.stopPropagation(); undo(); }} disabled={!historyState.canUndo} title="Undo"><Undo2 size={17} /></button>
          <button onClick={(event) => { event.stopPropagation(); redo(); }} disabled={!historyState.canRedo} title="Redo"><Redo2 size={17} /></button>
          <span className={`sync-state ${connection}`}><i />{connection === "synced" ? "Supabase synced" : connection === "local" ? "Local draft" : "Connecting"}</span>
        </div>
      </header>

      <section className="workspace">
        <div className="canvas-wrap">
          {!loaded && <div className="loading">Opening map...</div>}
          <ReactFlow<MapNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            onNodeDoubleClick={(_, node) => editNode(node.id)}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setSelectedId(node.id);
              setMenu({ id: node.id, x: event.clientX, y: event.clientY });
            }}
            onInit={(instance) => {
              flowInstance.current = instance;
              if (pendingViewport.current) void instance.setViewport(pendingViewport.current);
            }}
            onMoveEnd={(_, viewport) => localStorage.setItem(mapViewportKey, JSON.stringify(viewport))}
            minZoom={0.18}
            maxZoom={1.8}
            deleteKeyCode={null}
            selectionOnDrag={false}
            panOnDrag
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#d7d4cb" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(node) => node.data.aiSolution ? "#0f766e" : "#d7d3c8"} maskColor="rgba(247, 246, 241, .78)" />
          </ReactFlow>
        </div>
      </section>

      {menu && menuNode && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => editNode(menu.id)}><Edit3 size={15} />Edit</button>
          <button onClick={() => addChild(menu.id)}><Plus size={15} />Add child</button>
          <button onClick={() => duplicateNode(menu.id)}><Copy size={15} />Duplicate</button>
          <button onClick={() => toggleAi(menu.id)}><Bot size={15} />{menuNode.data.aiSolution ? "Remove AI solution" : "Mark as AI solution"}</button>
          <button onClick={() => toggleRepeatedWork(menu.id)}><Redo2 size={15} />{menuNode.data.repeatedWork ? "Remove repeated work" : "Mark as most repeated work"}</button>
          <div />
          <button className="danger" onClick={() => deleteNode(menu.id)}><Trash2 size={15} />Delete branch</button>
        </div>
      )}

      {editor && (
        <div className="modal-backdrop" onMouseDown={() => setEditor(null)}>
          <form className="node-editor" onSubmit={(event) => { event.preventDefault(); saveEditor(); }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="editor-head"><div><span>{editor.id ? "Edit node" : "New node"}</span><h2>{editor.id ? "Refine this step" : "Add to the operating map"}</h2></div><button type="button" onClick={() => setEditor(null)}><X size={18} /></button></div>
            <label>Heading<input autoFocus value={editor.heading} onChange={(event) => setEditor({ ...editor, heading: event.target.value })} placeholder="e.g. Lead qualification" maxLength={90} /></label>
            <label>Description <span>Optional</span><textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} placeholder="What happens at this step?" rows={4} maxLength={320} /></label>
            <div className="editor-actions"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button type="submit" disabled={!editor.heading.trim()}>{editor.id ? "Save changes" : "Add node"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
