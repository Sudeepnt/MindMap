"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyNodeChanges,
  type Connection,
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
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Edit3,
  Network,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase";
import type { MapNode, MapNodeData, StoredConnection as StoredConnectionRow, StoredNode } from "@/lib/types";

const DEFAULT_MAP_ID = "00000000-0000-4000-8000-000000000001";
const STORAGE_KEY = "opscanvas-draft-v2";
const VIEWPORT_KEY = "opscanvas-viewport-v2";
const CONNECTIONS_KEY = "opscanvas-connections-v1";
const CLOUD_MIGRATION_KEY = "opscanvas-cloud-migrated-v1";
const X_GAP = 330;
const Y_GAP = 150;

const subscribeToPhoneViewport = (notify: () => void) => {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

const getPhoneViewport = () => window.matchMedia("(max-width: 760px)").matches;
const getServerPhoneViewport = () => false;

type SeedOptions = {
  aiSolution?: boolean;
  repeatedWork?: boolean;
  shape?: MapNodeData["shape"];
  color?: MapNodeData["color"];
  placement?: MapNodeData["placement"];
};

const seedNodes: MapNode[] = [
  makeNode("company", null, "Digital Marketing Agency", "Business operating model", 0),
  makeNode("departments", "company", "Departments", "Core functions of the business", 0, { color: "rose" }),
  makeNode("sales", "departments", "INTERNAL - SALES & BUSINESS DEVELOPMENT", "Turn qualified demand into clients", 0, { color: "blue" }),
  makeNode("operations", "departments", "Operations", "Deliver work consistently", 2),
  makeNode("finance", "departments", "Finance", "Cash flow, invoicing and reporting", 3),
  makeNode("people", "departments", "People & HR", "Hiring, onboarding and support", 4),
  makeNode("client-onboarding", "departments", "Client Onboarding", "", 5),
  makeNode("research", "departments", "Research", "", 6),
  makeNode("strategy", "departments", "Strategy", "", 7),
  makeNode("creative-production", "departments", "Creative Production", "", 8),

  makeNode("lead-gen", "sales", "Lead Generation", "", 0),
  makeNode("qualification", "sales", "Lead Qualification", "", 1),
  makeNode("discovery", "sales", "Discovery Call", "", 2),
  makeNode("proposal", "sales", "Proposal", "", 3),
  makeNode("contact-payment", "sales", "Contact+Payment", "", 4),

  makeNode("cold-email", "lead-gen", "Cold Email", "", 0),
  makeNode("linkedin-outreach", "lead-gen", "LinkedIn Outreach", "", 1),
  makeNode("seo", "lead-gen", "SEO", "", 2),
  makeNode("referrals", "lead-gen", "Referrals", "", 3),
  makeNode("automated-seo-ai", "seo", "Automated SEO AI", "", 0, { aiSolution: true, color: "yellow", shape: "rounded" }),

  makeNode("check-business-fit", "qualification", "Check Business Fit", "", 0),
  makeNode("check-budget", "qualification", "Check Budget", "", 1),
  makeNode("identify-decision-maker", "qualification", "Identify Decision Maker", "", 2),

  makeNode("define-services", "proposal", "Define Services", "", 0),
  makeNode("calculate-price", "proposal", "Calculate Price", "", 1),
  makeNode("define-deliverables", "proposal", "Define Deliverables", "", 2),

  makeNode("negotiate-terms", "contact-payment", "Negotiate Terms", "", 0),
  makeNode("sign-contract", "contact-payment", "Sign Contract", "", 1, { repeatedWork: true, color: "yellow", shape: "rounded" }),
  makeNode("create-invoice", "contact-payment", "Create Invoice", "", 2, { repeatedWork: true, color: "yellow", shape: "rounded" }),
  makeNode("receive-payment", "contact-payment", "Receive Payment", "", 3, { repeatedWork: true, color: "yellow", shape: "rounded" }),

  makeNode("assign-team", "operations", "Assign Team", "", 0),
  makeNode("create-client-workspace", "operations", "Create Client Workspace", "", 1),
  makeNode("create-tasks", "assign-team", "Create Tasks", "", 0),
  makeNode("track-deadlines", "create-tasks", "Track Deadlines", "", 0),
  makeNode("automated-ai-telemetry", "track-deadlines", "Automated AI Telemetry", "", 0, { aiSolution: true, color: "yellow", shape: "rounded" }),
];

function makeNode(
  id: string,
  parentId: string | null,
  heading: string,
  description: string,
  sortOrder: number,
  options: SeedOptions = {},
): MapNode {
  return {
    id,
    type: "businessNode",
    position: { x: 0, y: 0 },
    data: {
      heading,
      description,
      parentId,
      sortOrder,
      collapsed: false,
      aiSolution: options.aiSolution ?? false,
      repeatedWork: options.repeatedWork ?? false,
      shape: options.shape ?? "box",
      color: options.color ?? "default",
      placement: options.placement ?? "right",
    },
  };
}

function fromStoredNode(item: StoredNode): MapNode {
  return {
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
      shape: item.node_shape ?? "box",
      color: item.node_color ?? "default",
      placement: item.placement ?? "right",
      positionLocked: item.position_locked ?? false,
    },
  };
}

function fromStoredConnection(item: StoredConnectionRow): StoredMapConnection {
  return {
    id: item.id,
    source: item.source_id,
    target: item.target_id,
    sourceHandle: item.source_handle,
    targetHandle: item.target_handle,
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

function nodeSizeClass(data: MapNodeData): "" | "is-wide" | "is-extra-wide" {
  const headingLength = data.heading.trim().length;
  if (headingLength > 36) return "is-extra-wide";
  if (headingLength > 18) return "is-wide";
  return "";
}

function layoutTree(nodes: MapNode[]): MapNode[] {
  if (!nodes.length) return nodes;
  const byParent = new Map<string | null, MapNode[]>();
  nodes.forEach((node) => {
    if (node.data.placement === "below") return;
    const group = byParent.get(node.data.parentId) ?? [];
    group.push(node);
    byParent.set(node.data.parentId, group);
  });
  byParent.forEach((group) => group.sort((a, b) => a.data.sortOrder - b.data.sortOrder));

  let nextLeafY = 0;
  const positions = new Map<string, { x: number; y: number }>();
  const hidden = new Set<string>();

  const estimatedHeight = (node: MapNode) => {
    if (node.data.shape !== "diamond") return node.data.description ? 96 : 54;
    const sizeClass = nodeSizeClass(node.data);
    return sizeClass === "is-extra-wide" ? 250 : sizeClass === "is-wide" ? 220 : 190;
  };
  const verticalSpan = (node: MapNode): number => {
    const belowChildren = nodes
      .filter((child) => child.data.parentId === node.id && child.data.placement === "below")
      .sort((a, b) => a.data.sortOrder - b.data.sortOrder);
    if (!belowChildren.length || node.data.collapsed) return estimatedHeight(node);
    return estimatedHeight(node) + 70 + belowChildren.reduce((sum, child, index) => (
      sum + verticalSpan(child) + (index ? 44 : 0)
    ), 0);
  };
  const place = (node: MapNode, depth: number): number => {
    const children = byParent.get(node.id) ?? [];
    if (node.data.collapsed) {
      descendantsOf(nodes, node.id).forEach((id) => hidden.add(id));
    }
    const visibleChildren = node.data.collapsed ? [] : children;
    let centerY: number;
    if (!visibleChildren.length) {
      centerY = nextLeafY + estimatedHeight(node) / 2;
      nextLeafY += Math.max(Y_GAP, verticalSpan(node) + 44);
    } else {
      const childYs = visibleChildren.map((child) => place(child, depth + 1));
      centerY = (childYs[0] + childYs[childYs.length - 1]) / 2;
      const verticalBottom = centerY - estimatedHeight(node) / 2 + verticalSpan(node);
      nextLeafY = Math.max(nextLeafY, verticalBottom + 44);
    }
    positions.set(node.id, { x: depth * X_GAP, y: centerY - estimatedHeight(node) / 2 });
    return centerY;
  };

  (byParent.get(null) ?? []).forEach((root) => place(root, 0));
  const placeMixedBranches = (node: MapNode) => {
    const parentPosition = positions.get(node.id);
    if (!parentPosition || node.data.collapsed) return;

    const rightChildren = byParent.get(node.id) ?? [];
    const unplacedRight = rightChildren.filter((child) => !positions.has(child.id));
    const rightStartY = parentPosition.y - ((unplacedRight.length - 1) * Y_GAP) / 2;
    unplacedRight.forEach((child, index) => {
      positions.set(child.id, { x: parentPosition.x + X_GAP, y: rightStartY + index * Y_GAP });
    });
    rightChildren.forEach(placeMixedBranches);

    const belowChildren = nodes
      .filter((child) => child.data.parentId === node.id && child.data.placement === "below")
      .sort((a, b) => a.data.sortOrder - b.data.sortOrder);
    let belowY = parentPosition.y + estimatedHeight(node) + 70;
    belowChildren.forEach((child) => {
      positions.set(child.id, { x: parentPosition.x, y: belowY });
      belowY += estimatedHeight(child) + 44;
      placeMixedBranches(child);
    });
  };
  (byParent.get(null) ?? []).forEach(placeMixedBranches);
  const minY = Math.min(...Array.from(positions.values(), (position) => position.y), 0);
  return nodes.map((node) => ({
    ...node,
    hidden: hidden.has(node.id),
    position: node.data.positionLocked
      ? node.position
      : positions.has(node.id)
        ? { x: positions.get(node.id)!.x, y: positions.get(node.id)!.y - minY }
        : node.position,
  }));
}

function migrateManualPositions(nodes: MapNode[]): MapNode[] {
  const automatic = layoutTree(nodes.map((node) => ({
    ...node,
    data: { ...node.data, positionLocked: false },
  })));
  const automaticById = new Map(automatic.map((node) => [node.id, node.position]));

  return nodes.map((node) => {
    const expected = automaticById.get(node.id);
    const moved = expected && (
      Math.abs(node.position.x - expected.x) > 2
      || Math.abs(node.position.y - expected.y) > 2
    );
    return moved || node.data.positionLocked
      ? { ...node, data: { ...node.data, positionLocked: true } }
      : node;
  });
}

function BusinessNode({ id, data, selected }: NodeProps<MapNode>) {
  const sizeClass = nodeSizeClass(data);
  return (
    <div className={`map-node shape-${data.shape ?? "box"} color-${data.color ?? "default"} ${sizeClass} ${!data.description ? "is-compact" : ""} ${selected || data.uiSelected ? "is-selected" : ""} ${data.aiSolution ? "is-ai" : ""} ${data.repeatedWork ? "is-repeated" : ""}`}>
      <Handle type="target" position={Position.Left} className="node-handle" isConnectable={false} />
      <Handle id="top-target" type="target" position={Position.Top} className="node-handle vertical-handle" isConnectable={false} />
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
      <Handle type="source" position={Position.Right} className="node-handle" isConnectable={false} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="node-handle vertical-handle" isConnectable={false} />
      <Handle id="relation-source" type="source" position={Position.Right} className="relation-handle relation-source" title="Drag to connect this node" />
      <Handle id="relation-target" type="target" position={Position.Left} className={`relation-handle relation-target ${data.connectionTargetVisible ? "is-visible" : ""}`} title="Drop to connect to this node" />
      <button className="add-control add-child nodrag" onClick={() => data.onAddChild?.(id)} aria-label="Add child">
        <Plus size={16} />
        <span>Add child</span>
      </button>
      <button className="add-control add-sibling nodrag" onClick={() => data.onAddBelow?.(id)} aria-label="Add node below">
        <Plus size={15} />
      </button>
    </div>
  );
}

const nodeTypes = { businessNode: BusinessNode };

type EditorState = { id: string | null; parentId: string | null; heading: string; description: string; shape: MapNodeData["shape"]; color: MapNodeData["color"] };
type MenuState = { id: string; x: number; y: number } | null;
type BranchClipboard = { rootId: string; nodes: MapNode[] } | null;
type StoredMapConnection = Pick<Edge, "id" | "source" | "target" | "sourceHandle" | "targetHandle">;

export function BusinessMap({ mapId, mapTitle }: { mapId: string; mapTitle: string }) {
  return <ReactFlowProvider><BusinessMapCanvas mapId={mapId} mapTitle={mapTitle} /></ReactFlowProvider>;
}

function BusinessMapCanvas({ mapId, mapTitle }: { mapId: string; mapTitle: string }) {
  const phoneViewport = useSyncExternalStore(subscribeToPhoneViewport, getPhoneViewport, getServerPhoneViewport);
  const [interactionModeOverride, setInteractionMode] = useState<"view" | "edit" | null>(null);
  const interactionMode = interactionModeOverride ?? (phoneViewport ? "view" : "edit");
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [loaded, setLoaded] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [branchClipboard, setBranchClipboard] = useState<BranchClipboard>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [connections, setConnections] = useState<StoredMapConnection[]>([]);
  const [connectionsVisible, setConnectionsVisible] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const past = useRef<MapNode[][]>([]);
  const future = useRef<MapNode[][]>([]);
  const flowInstance = useRef<ReactFlowInstance<MapNode, Edge> | null>(null);
  const pendingViewport = useRef<Viewport | null>(null);
  const selectedNodeIds = useRef<Set<string>>(new Set());
  const additiveSelectionPressed = useRef(false);
  const nodeGestureActive = useRef(false);
  const marqueeSelecting = useRef(false);
  const mapStorageKey = `${STORAGE_KEY}:${mapId}`;
  const mapViewportKey = `${VIEWPORT_KEY}:${mapId}`;
  const mobileMapViewportKey = `${VIEWPORT_KEY}:mobile-v2:${mapId}`;
  const mapConnectionsKey = `${CONNECTIONS_KEY}:${mapId}`;
  const mapCloudMigrationKey = `${CLOUD_MIGRATION_KEY}:${mapId}`;
  const cloudSaveQueue = useRef<{ nodes: MapNode[]; connections: StoredMapConnection[] } | null>(null);
  const cloudSaveRunning = useRef(false);
  const cloudSnapshotToSkip = useRef<string | null>(null);
  const lastPersistedSnapshot = useRef<string | null>(null);
  const cloudRetryTimer = useRef<number | null>(null);
  const realtimeRefreshTimer = useRef<number | null>(null);
  const viewportSaveTimer = useRef<number | null>(null);

  function selectNode(event: MouseEvent | React.MouseEvent, id: string) {
    if (interactionMode === "view") return;
    const additive = additiveSelectionPressed.current || event.shiftKey || event.metaKey || event.ctrlKey;
    const nextSelection = new Set(selectedNodeIds.current);
    if (additive) {
      if (nextSelection.has(id)) nextSelection.delete(id);
      else nextSelection.add(id);
    } else if (!nextSelection.has(id) || nextSelection.size <= 1) {
      nextSelection.clear();
      nextSelection.add(id);
    }
    const updated = nodes.map((item) => ({
      ...item,
      selected: nextSelection.has(item.id),
      data: {
        ...item.data,
        uiSelected: nextSelection.has(item.id),
      },
    }));
    const selectedNodes = updated.filter((item) => item.data.uiSelected);
    selectedNodeIds.current = new Set(selectedNodes.map((item) => item.id));
    setNodes(updated);
    setSelectedCount(selectedNodes.length);
    setSelectedId(selectedNodes.some((item) => item.id === id)
      ? id
      : selectedNodes.at(-1)?.id ?? null);
    setSelectedConnectionId(null);
  }

  const handleSelectionMouseDown = useEffectEvent((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".canvas-wrap") || target.closest("button, .react-flow__handle")) return;
    const nodeElement = target.closest<HTMLElement>(".react-flow__node[data-id]");
    const id = nodeElement?.dataset.id;
    if (id) {
      nodeGestureActive.current = true;
      selectNode(event, id);
      window.setTimeout(() => { nodeGestureActive.current = false; }, 0);
    }
  });

  const trackSelectionModifier = useEffectEvent((event: KeyboardEvent) => {
    additiveSelectionPressed.current = event.shiftKey || event.metaKey || event.ctrlKey;
  });

  const clearSelectionModifier = useEffectEvent(() => {
    additiveSelectionPressed.current = false;
  });

  const hydrateActions = (items: MapNode[]) => items.map((node) => ({
    ...node,
    data: {
      ...node.data,
      childCount: items.filter((candidate) => candidate.data.parentId === node.id).length,
      onAddChild: addChild,
      onAddBelow: addBelow,
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
    setEditor({ id: null, parentId, heading: "", description: "", shape: "box", color: "default" });
    setMenu(null);
    setSelectedId(parentId);
    pendingSort.current = siblings.length;
    pendingPlacement.current = "right";
  }

  const pendingSort = useRef(0);
  const pendingPlacement = useRef<MapNodeData["placement"]>("right");

  function addBelow(id: string) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    pendingSort.current = nodes.filter((item) => item.data.parentId === id && item.data.placement === "below").length;
    pendingPlacement.current = "below";
    setEditor({ id: null, parentId: id, heading: "", description: "", shape: "box", color: "default" });
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
    delete data.onAddBelow;
    delete data.onToggle;
    delete data.uiSelected;
    delete data.childCount;
    delete data.connectionTargetVisible;
    return { ...node, selected: false, data };
  }

  const nodeRows = (current: MapNode[]) => current.map(stripActions).map((node) => ({
    id: node.id,
    parent_id: node.data.parentId,
    heading: node.data.heading,
    description: node.data.description,
    sort_order: node.data.sortOrder,
    position_x: node.position.x,
    position_y: node.position.y,
    collapsed: node.data.collapsed,
    ai_solution: node.data.aiSolution,
    repeated_work: node.data.repeatedWork ?? false,
    node_shape: node.data.shape ?? "box",
    node_color: node.data.color ?? "default",
    placement: node.data.placement ?? "right",
    position_locked: node.data.positionLocked ?? false,
  }));

  const connectionRows = (current: StoredMapConnection[]) => current.map((connection) => ({
    id: connection.id,
    source_id: connection.source,
    target_id: connection.target,
    source_handle: connection.sourceHandle ?? null,
    target_handle: connection.targetHandle ?? null,
  }));

  const saveCloudState = async (currentNodes: MapNode[], currentConnections: StoredMapConnection[]) => {
    const { error } = await createClient().rpc("save_business_map_state", {
      p_map_id: mapId,
      p_title: mapTitle,
      p_nodes: nodeRows(currentNodes),
      p_connections: connectionRows(currentConnections),
    });
    return error;
  };

  const stateSnapshot = (currentNodes: MapNode[], currentConnections: StoredMapConnection[]) => JSON.stringify({
    nodes: currentNodes.map(stripActions),
    connections: currentConnections,
  });

  const flushCloudSave = async () => {
    if (cloudSaveRunning.current) return;
    cloudSaveRunning.current = true;
    while (cloudSaveQueue.current) {
      const queued = cloudSaveQueue.current;
      cloudSaveQueue.current = null;
      const error = await saveCloudState(queued.nodes, queued.connections);
      if (error) {
        cloudSaveQueue.current = queued;
        if (cloudRetryTimer.current) window.clearTimeout(cloudRetryTimer.current);
        cloudRetryTimer.current = window.setTimeout(() => void flushCloudSave(), 1000);
        break;
      }
      lastPersistedSnapshot.current = stateSnapshot(queued.nodes, queued.connections);
      localStorage.setItem(mapCloudMigrationKey, "true");
    }
    cloudSaveRunning.current = false;
  };

  const queueSave = useEffectEvent((currentNodes: MapNode[], currentConnections: StoredMapConnection[]) => {
    const cleanNodes = currentNodes.map(stripActions);
    localStorage.setItem(mapStorageKey, JSON.stringify(cleanNodes));
    localStorage.setItem(mapConnectionsKey, JSON.stringify(currentConnections));
    const snapshot = stateSnapshot(cleanNodes, currentConnections);
    if (lastPersistedSnapshot.current === snapshot) return;
    if (cloudSnapshotToSkip.current === snapshot) {
      cloudSnapshotToSkip.current = null;
      lastPersistedSnapshot.current = snapshot;
      return;
    }
    cloudSaveQueue.current = { nodes: cleanNodes, connections: currentConnections };
    void flushCloudSave();
  });

  const parseLocalNodes = (): MapNode[] | null => {
    const legacyDraft = mapId === DEFAULT_MAP_ID ? localStorage.getItem(STORAGE_KEY) : null;
    const cached = localStorage.getItem(mapStorageKey) ?? legacyDraft;
    if (cached === null) return null;
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Invalid map data");
      return parsed.filter((item): item is MapNode => Boolean(
        item && typeof item === "object" && "id" in item && "data" in item && "position" in item,
      ));
    } catch {
      localStorage.removeItem(mapStorageKey);
      return null;
    }
  };

  const parseLocalConnections = (nodeIds: Set<string>): StoredMapConnection[] => {
    const cachedConnections = localStorage.getItem(mapConnectionsKey);
    if (!cachedConnections) return [];
    try {
      const parsed = JSON.parse(cachedConnections) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Invalid connection data");
      return parsed
        .filter((item): item is StoredMapConnection => Boolean(
          item
          && typeof item === "object"
          && "id" in item
          && "source" in item
          && "target" in item
          && typeof item.id === "string"
          && typeof item.source === "string"
          && typeof item.target === "string"
          && item.source !== item.target
          && nodeIds.has(item.source)
          && nodeIds.has(item.target),
        ))
        .map((connection) => ({
          ...connection,
          sourceHandle: connection.sourceHandle === "relation" ? "relation-source" : connection.sourceHandle,
          targetHandle: connection.targetHandle === "relation" ? "relation-target" : connection.targetHandle,
        }));
    } catch {
      localStorage.removeItem(mapConnectionsKey);
      return [];
    }
  };

  const applyLoadedState = (nextNodes: MapNode[], nextConnections: StoredMapConnection[], viewport: Viewport | null) => {
    const preparedNodes = layoutTree(nextNodes);
    const snapshot = stateSnapshot(preparedNodes, nextConnections);
    cloudSnapshotToSkip.current = snapshot;
    lastPersistedSnapshot.current = snapshot;
    selectedNodeIds.current.clear();
    setNodes(hydrateActions(preparedNodes));
    setConnections(nextConnections);
    setLoaded(true);
    pendingViewport.current = viewport;
    window.setTimeout(() => {
      if (!flowInstance.current) return;
      if (viewport) void flowInstance.current.setViewport(viewport);
      else if (window.matchMedia("(max-width: 760px)").matches) {
        const root = preparedNodes.find((node) => node.data.parentId === null) ?? preparedNodes[0];
        if (root) void flowInstance.current.setCenter(root.position.x + 115, root.position.y + 43, { zoom: 0.72 });
      } else void flowInstance.current.fitView({ padding: 0.25 });
    }, 0);
  };

  const loadMap = useEffectEvent(async () => {
    const mobileViewport = window.matchMedia("(max-width: 760px)").matches;
    const localNodes = parseLocalNodes();
    const fallbackNodes = localNodes
      ? migrateManualPositions(localNodes.map(stripActions))
      : layoutTree((mapId === DEFAULT_MAP_ID
        ? seedNodes.map((node) => node.id === "company" ? { ...node, data: { ...node.data, heading: mapTitle } } : node)
        : [makeNode(`root-${mapId}`, null, mapTitle, "Business operating model", 0)]).map(stripActions));
    const localConnections = parseLocalConnections(new Set(fallbackNodes.map((node) => node.id)));

    const legacyViewport = localStorage.getItem(mobileViewport ? mobileMapViewportKey : mapViewportKey)
      ?? (!mobileViewport && mapId === DEFAULT_MAP_ID ? localStorage.getItem(VIEWPORT_KEY) : null);
    const localViewport = legacyViewport ? JSON.parse(legacyViewport) as Viewport : null;
    const supabase = createClient();
    const [{ data: cloudNodes, error: nodeError }, { data: cloudConnections, error: connectionError }, { data: cloudMap, error: mapError }] = await Promise.all([
      supabase.from("business_map_nodes").select("*").eq("map_id", mapId).order("sort_order"),
      supabase.from("business_map_connections").select("*").eq("map_id", mapId),
      supabase.from("business_maps").select("id,viewport_x,viewport_y,viewport_zoom").eq("id", mapId).maybeSingle(),
    ]);

    if (nodeError || connectionError || mapError) {
      applyLoadedState(fallbackNodes, localConnections, localViewport);
      return;
    }

    const needsLocalMigration = Boolean(localNodes) && localStorage.getItem(mapCloudMigrationKey) !== "true";
    if (needsLocalMigration || !cloudMap) {
      applyLoadedState(fallbackNodes, localConnections, localViewport);
      const error = await saveCloudState(fallbackNodes, localConnections);
      if (!error) localStorage.setItem(mapCloudMigrationKey, "true");
      return;
    }

    const nextNodes = (cloudNodes as StoredNode[]).map(fromStoredNode);
    const nextConnections = (cloudConnections as StoredConnectionRow[]).map(fromStoredConnection);
    const cloudViewport = mobileViewport || cloudMap.viewport_zoom == null
      ? localViewport
      : { x: cloudMap.viewport_x ?? 0, y: cloudMap.viewport_y ?? 0, zoom: cloudMap.viewport_zoom };
    applyLoadedState(nextNodes, nextConnections, cloudViewport);
    localStorage.setItem(mapCloudMigrationKey, "true");
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMap(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    queueSave(nodes, connections);
  }, [nodes, connections, loaded]);

  const refreshFromCloud = useEffectEvent(async () => {
    if (!loaded || cloudSaveRunning.current || cloudSaveQueue.current) return;
    const supabase = createClient();
    const [{ data: cloudNodes, error: nodeError }, { data: cloudConnections, error: connectionError }] = await Promise.all([
      supabase.from("business_map_nodes").select("*").eq("map_id", mapId).order("sort_order"),
      supabase.from("business_map_connections").select("*").eq("map_id", mapId),
    ]);
    if (nodeError || connectionError) return;
    const nextNodes = (cloudNodes as StoredNode[]).map(fromStoredNode);
    const nextConnections = (cloudConnections as StoredConnectionRow[]).map(fromStoredConnection);
    const preparedNodes = layoutTree(nextNodes);
    const snapshot = stateSnapshot(preparedNodes, nextConnections);
    cloudSnapshotToSkip.current = snapshot;
    lastPersistedSnapshot.current = snapshot;
    setNodes(hydrateActions(preparedNodes.map((node) => ({
      ...node,
      selected: selectedNodeIds.current.has(node.id),
      data: { ...node.data, uiSelected: selectedNodeIds.current.has(node.id) },
    }))));
    setConnections(nextConnections);
    localStorage.setItem(mapStorageKey, JSON.stringify(preparedNodes.map(stripActions)));
    localStorage.setItem(mapConnectionsKey, JSON.stringify(nextConnections));
  });

  const scheduleRealtimeRefresh = useEffectEvent(() => {
    if (realtimeRefreshTimer.current) window.clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = window.setTimeout(() => void refreshFromCloud(), 80);
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`business-map-state-${mapId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "business_map_nodes",
        filter: `map_id=eq.${mapId}`,
      }, scheduleRealtimeRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "business_map_connections",
        filter: `map_id=eq.${mapId}`,
      }, scheduleRealtimeRefresh)
      .subscribe();
    const refreshOnFocus = () => void refreshFromCloud();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      if (realtimeRefreshTimer.current) window.clearTimeout(realtimeRefreshTimer.current);
      if (cloudRetryTimer.current) window.clearTimeout(cloudRetryTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [mapId]);

  const displayNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      connectionTargetVisible: Boolean(connectingSourceId) && node.id !== connectingSourceId,
    },
  }));

  const treeEdges: Edge[] = nodes
    .filter((node) => node.data.parentId && !node.hidden)
    .map((node) => ({
      id: `edge-${node.data.parentId}-${node.id}`,
      source: node.data.parentId!,
      target: node.id,
      sourceHandle: node.data.placement === "below" ? "bottom-source" : undefined,
      targetHandle: node.data.placement === "below" ? "top-target" : undefined,
      type: "smoothstep",
      style: { stroke: node.data.aiSolution ? "#0f766e" : "#a9a8a2", strokeWidth: 1.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: node.data.aiSolution ? "#0f766e" : "#a9a8a2", width: 14, height: 14 },
    }));

  const relationEdges: Edge[] = connectionsVisible ? connections.map((connection) => {
    const selected = connection.id === selectedConnectionId;
    return {
      ...connection,
      type: "smoothstep",
      className: "relation-edge",
      selected,
      zIndex: 2,
      pathOptions: {
        borderRadius: 16,
        offset: 24,
      },
      style: {
        stroke: "#17845f",
        strokeWidth: selected ? 3 : 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#17845f",
        width: 18,
        height: 18,
      },
    };
  }) : [];

  const edges = [...treeEdges, ...relationEdges];

  const connectNodes = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const duplicate = connections.some((item) => (
      item.source === connection.source && item.target === connection.target
    ));
    if (duplicate) return;
    setConnections((current) => [...current, {
      id: `relation-${crypto.randomUUID()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    }]);
  };

  const onNodesChange = (changes: NodeChange<MapNode>[]) => {
    const isMarqueeSelection = marqueeSelecting.current;
    const movedNodeIds = new Set<string>();
    const acceptedChanges = changes.filter((change) => change.type !== "select" || isMarqueeSelection);
    acceptedChanges.forEach((change) => {
      if (change.type === "position" && change.position) movedNodeIds.add(change.id);
    });
    if (isMarqueeSelection) {
      acceptedChanges.forEach((change) => {
        if (change.type !== "select") return;
        if (change.selected) selectedNodeIds.current.add(change.id);
        else selectedNodeIds.current.delete(change.id);
      });
      setSelectedCount(selectedNodeIds.current.size);
      setSelectedId((current) => current && selectedNodeIds.current.has(current)
        ? current
        : [...selectedNodeIds.current].at(-1) ?? null);
      setSelectedConnectionId(null);
    }
    setNodes((current) => hydrateActions(
      applyNodeChanges(acceptedChanges, current).map((node) => ({
        ...node,
        data: {
          ...node.data,
          ...(movedNodeIds.has(node.id) ? { positionLocked: true } : {}),
          ...(isMarqueeSelection ? { uiSelected: selectedNodeIds.current.has(node.id) } : {}),
        },
      })),
    ));
  };

  const deleteNodes = (ids: Iterable<string>) => {
    const deletedIds = new Set<string>();
    for (const id of ids) {
      deletedIds.add(id);
      descendantsOf(nodes, id).forEach((descendantId) => deletedIds.add(descendantId));
    }
    if (!deletedIds.size) return;
    commit((current) => current.filter((node) => !deletedIds.has(node.id)));
    setConnections((current) => current.filter((connection) => (
      !deletedIds.has(connection.source) && !deletedIds.has(connection.target)
    )));
    setSelectedId(null);
    setSelectedCount(0);
    selectedNodeIds.current.clear();
    setSelectedConnectionId(null);
    setMenu(null);
  };

  const deleteNode = (id: string) => deleteNodes([id]);

  const addRoot = () => {
    pendingSort.current = nodes.filter((node) => node.data.parentId === null).length;
    pendingPlacement.current = "right";
    setEditor({ id: null, parentId: null, heading: "", description: "", shape: "box", color: "default" });
  };

  const restoreStarterMap = () => {
    const restored = seedNodes.map((node) => node.id === "company"
      ? { ...node, data: { ...node.data, heading: mapTitle } }
      : node);
    setConnections([]);
    commit(() => restored);
  };

  const duplicateNode = (id: string) => {
    const source = nodes.find((node) => node.id === id);
    if (!source) return;
    const idCopy = crypto.randomUUID();
    const sortOrder = nodes.filter((node) => node.data.parentId === source.data.parentId).length;
    const copy = makeNode(idCopy, source.data.parentId, `${source.data.heading} copy`, source.data.description, sortOrder, {
      aiSolution: source.data.aiSolution,
      repeatedWork: source.data.repeatedWork,
      shape: source.data.shape,
      color: source.data.color,
      placement: source.data.placement,
    });
    copy.data = {
      ...source.data,
      heading: `${source.data.heading} copy`,
      sortOrder,
      positionLocked: false,
    };
    copy.position = { x: 0, y: 0 };
    commit((current) => [...current, copy]);
    setSelectedId(idCopy);
    setMenu(null);
  };

  const copyBranch = (id: string) => {
    const branchIds = descendantsOf(nodes, id);
    branchIds.add(id);
    setBranchClipboard({
      rootId: id,
      nodes: nodes.filter((node) => branchIds.has(node.id)).map(stripActions),
    });
    setMenu(null);
  };

  const pasteBranch = (targetId: string) => {
    if (!branchClipboard) return;
    const idMap = new Map(branchClipboard.nodes.map((node) => [node.id, crypto.randomUUID()]));
    const nextSortOrder = nodes.filter((node) => node.data.parentId === targetId).length;
    const copies = branchClipboard.nodes.map((node) => {
      const isRoot = node.id === branchClipboard.rootId;
      return {
        ...node,
        id: idMap.get(node.id)!,
        selected: false,
        position: { x: 0, y: 0 },
        data: {
          ...node.data,
          parentId: isRoot ? targetId : idMap.get(node.data.parentId!)!,
          sortOrder: isRoot ? nextSortOrder : node.data.sortOrder,
          placement: isRoot ? "right" : node.data.placement,
          collapsed: false,
          positionLocked: false,
        },
      } satisfies MapNode;
    });
    commit((current) => [...current, ...copies]);
    setSelectedId(idMap.get(branchClipboard.rootId)!);
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
    setEditor({ id, parentId: node.data.parentId, heading: node.data.heading, description: node.data.description, shape: node.data.shape ?? "box", color: node.data.color ?? "default" });
    setMenu(null);
  };

  const saveEditor = () => {
    if (!editor?.heading.trim()) return;
    if (editor.id) {
      commit((current) => current.map((node) => node.id === editor.id
        ? { ...node, data: { ...node.data, heading: editor.heading.trim(), description: editor.description.trim(), shape: editor.shape, color: editor.color } }
        : node), false);
    } else {
      const id = crypto.randomUUID();
      const newNode = makeNode(id, editor.parentId, editor.heading.trim(), editor.description.trim(), pendingSort.current);
      newNode.data.shape = editor.shape;
      newNode.data.color = editor.color;
      newNode.data.placement = pendingPlacement.current;
      commit((current) => [...current, newNode]);
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
    if (target.matches("input, textarea, select")) return;
    if (interactionMode === "view") return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (command && event.key.toLowerCase() === "c" && selectedId) {
      event.preventDefault();
      copyBranch(selectedId);
    } else if (command && event.key.toLowerCase() === "v" && selectedId && branchClipboard) {
      event.preventDefault();
      pasteBranch(selectedId);
    } else if (command && event.key.toLowerCase() === "d" && selectedId) {
      event.preventDefault();
      duplicateNode(selectedId);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selectedConnectionId) {
      event.preventDefault();
      setConnections((current) => current.filter((connection) => connection.id !== selectedConnectionId));
      setSelectedConnectionId(null);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
      event.preventDefault();
      const idsToDelete = new Set(selectedNodeIds.current);
      idsToDelete.add(selectedId);
      deleteNodes(idsToDelete);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    window.addEventListener("keydown", trackSelectionModifier);
    window.addEventListener("keyup", trackSelectionModifier);
    window.addEventListener("blur", clearSelectionModifier);
    document.addEventListener("mousedown", handleSelectionMouseDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyboard);
      window.removeEventListener("keydown", trackSelectionModifier);
      window.removeEventListener("keyup", trackSelectionModifier);
      window.removeEventListener("blur", clearSelectionModifier);
      document.removeEventListener("mousedown", handleSelectionMouseDown, true);
    };
  }, []);

  const menuNode = menu ? nodes.find((node) => node.id === menu.id) : null;

  return (
    <main className={`app-shell mode-${interactionMode}`} onClick={() => setMenu(null)}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>deepmap.ai</span></div>
        <Link className="mobile-map-back" href="/" aria-label="Back to all businesses"><ArrowLeft size={18} /></Link>
        <strong className="mobile-map-title">{mapTitle}</strong>
        <div className="map-title"><Link href="/"><ArrowLeft size={14} />All businesses</Link><ChevronRight size={14} /><strong>{mapTitle}</strong></div>
        <label className="mobile-mode-select">
          <span>Map mode</span>
          <select value={interactionMode} onChange={(event) => {
            const mode = event.target.value as "view" | "edit";
            setInteractionMode(mode);
            if (mode === "view") {
              selectedNodeIds.current.clear();
              setSelectedCount(0);
              setSelectedId(null);
              setMenu(null);
              setNodes((current) => current.map((node) => ({
                ...node,
                selected: false,
                data: { ...node.data, uiSelected: false },
              })));
            }
          }}>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        </label>
        <div className="top-actions">
          <button
            className={`connections-toggle ${connectionsVisible ? "is-on" : ""}`}
            aria-pressed={connectionsVisible}
            onClick={(event) => {
              event.stopPropagation();
              setConnectionsVisible((visible) => !visible);
              setSelectedConnectionId(null);
            }}
            title={connectionsVisible ? "Hide connection lines" : "Show connection lines"}
          >
            <Network size={15} />
            <span>Connections</span>
            <i>{connectionsVisible ? "On" : "Off"}</i>
          </button>
          <button onClick={(event) => { event.stopPropagation(); undo(); }} disabled={!historyState.canUndo} title="Undo"><Undo2 size={17} /></button>
          <button onClick={(event) => { event.stopPropagation(); redo(); }} disabled={!historyState.canRedo} title="Redo"><Redo2 size={17} /></button>
          {selectedCount > 1 && <span className="selection-count">{selectedCount} nodes selected</span>}
        </div>
      </header>

      <section className="workspace">
        <div className="canvas-wrap">
          {!loaded && <div className="loading">Opening map...</div>}
          {loaded && !nodes.length && (
            <div className="empty-map">
              <div className="empty-map-mark"><Sparkles size={22} /></div>
              <strong>This map is empty</strong>
              <span>Add a first node, or bring back the Digital Marketing Agency starter tree.</span>
              <div>
                <button onClick={addRoot}><Plus size={16} />Add first node</button>
                {mapId === DEFAULT_MAP_ID && <button className="secondary" onClick={restoreStarterMap}><Redo2 size={16} />Restore starter map</button>}
              </div>
            </div>
          )}
          <ReactFlow<MapNode, Edge>
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={interactionMode === "edit"}
            nodesConnectable={interactionMode === "edit"}
            elementsSelectable={interactionMode === "edit"}
            onNodesChange={onNodesChange}
            onSelectionStart={() => {
              marqueeSelecting.current = true;
              nodeGestureActive.current = true;
            }}
            onSelectionEnd={() => {
              marqueeSelecting.current = false;
              window.setTimeout(() => { nodeGestureActive.current = false; }, 0);
            }}
            onConnect={connectNodes}
            onConnectStart={(_, params) => setConnectingSourceId(params.nodeId)}
            onConnectEnd={() => setConnectingSourceId(null)}
            connectionMode={ConnectionMode.Strict}
            isValidConnection={(connection) => Boolean(
              connection.source
              && connection.target
              && connection.source !== connection.target
              && !connections.some((item) => (
                item.source === connection.source && item.target === connection.target
              )),
            )}
            onEdgeClick={(_, edge) => {
              if (!edge.id.startsWith("relation-")) return;
              setSelectedConnectionId(edge.id);
              setSelectedId(null);
              selectedNodeIds.current.clear();
              setNodes(hydrateActions(nodes.map((node) => ({
                ...node,
                selected: false,
                data: { ...node.data, uiSelected: false },
              }))));
            }}
            onPaneClick={(event) => {
              if (nodeGestureActive.current) return;
              if ((event.target as HTMLElement).closest(".react-flow__node")) return;
              selectedNodeIds.current.clear();
              setNodes(hydrateActions(nodes.map((node) => ({
                ...node,
                selected: false,
                data: { ...node.data, uiSelected: false },
              }))));
              setSelectedCount(0);
              setSelectedId(null);
              setSelectedConnectionId(null);
            }}
            onNodeDoubleClick={(_, node) => {
              if (interactionMode === "edit") editNode(node.id);
            }}
            onNodeContextMenu={(event, node) => {
              if (interactionMode === "view") return;
              event.preventDefault();
              selectedNodeIds.current = new Set([node.id]);
              setNodes(hydrateActions(nodes.map((item) => ({
                ...item,
                selected: item.id === node.id,
                data: { ...item.data, uiSelected: item.id === node.id },
              }))));
              setSelectedCount(1);
              setSelectedId(node.id);
              setMenu({ id: node.id, x: event.clientX, y: event.clientY });
            }}
            onInit={(instance) => {
              flowInstance.current = instance;
              if (pendingViewport.current) void instance.setViewport(pendingViewport.current);
            }}
            onMoveEnd={(_, viewport) => {
              const mobileViewport = window.matchMedia("(max-width: 760px)").matches;
              localStorage.setItem(mobileViewport ? mobileMapViewportKey : mapViewportKey, JSON.stringify(viewport));
              if (mobileViewport) return;
              if (viewportSaveTimer.current) window.clearTimeout(viewportSaveTimer.current);
              viewportSaveTimer.current = window.setTimeout(() => {
                void createClient().from("business_maps").update({
                  viewport_x: viewport.x,
                  viewport_y: viewport.y,
                  viewport_zoom: viewport.zoom,
                  updated_at: new Date().toISOString(),
                }).eq("id", mapId);
              }, 100);
            }}
            minZoom={0.18}
            maxZoom={1.8}
            deleteKeyCode={null}
            selectionOnDrag={false}
            selectionMode={SelectionMode.Partial}
            selectionKeyCode="Shift"
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
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
          <button onClick={() => addBelow(menu.id)}><Plus size={15} />Add node below</button>
          <button onClick={() => copyBranch(menu.id)}><ClipboardCopy size={15} />Copy branch</button>
          <button onClick={() => pasteBranch(menu.id)} disabled={!branchClipboard}><ClipboardPaste size={15} />Paste as child</button>
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
            <fieldset className="shape-picker">
              <legend>Shape</legend>
              <div className="shape-options">
                {(["box", "diamond", "rounded"] as const).map((shape) => (
                  <button type="button" key={shape} aria-pressed={editor.shape === shape} onClick={() => setEditor({ ...editor, shape })}>
                    <i className={`shape-preview preview-${shape}`} />
                    <span>{shape === "box" ? "Box" : shape === "diamond" ? "Diamond" : "Rounded"}</span>
                  </button>
                ))}
              </div>
              <div className="color-picker-head"><span>Node color</span>{editor.color !== "default" && <button type="button" onClick={() => setEditor({ ...editor, color: "default" })}>Clear color</button>}</div>
              <div className="color-picker">
                {(["blue", "yellow", "rose", "lavender", "slate"] as const).map((color) => (
                  <button type="button" key={color} aria-label={`${color[0].toUpperCase()}${color.slice(1)} node color`} aria-pressed={editor.color === color} onClick={() => setEditor({ ...editor, color })}>
                    <i className={`color-swatch swatch-${color}`} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="editor-actions"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button type="submit" disabled={!editor.heading.trim()}>{editor.id ? "Save changes" : "Add node"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
