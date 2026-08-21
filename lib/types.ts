import type { Node } from "@xyflow/react";

export type MapNodeData = {
  heading: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
  collapsed: boolean;
  aiSolution: boolean;
  repeatedWork: boolean;
  humanBranch?: boolean;
  humanAiMix?: boolean;
  toolNode?: boolean;
  standaloneNode?: boolean;
  shape: "box" | "diamond" | "rounded" | "circle";
  color: "default" | "blue" | "yellow" | "rose" | "lavender" | "slate" | "red" | "green" | "orange" | "cyan" | "indigo";
  placement: "right" | "below" | "left" | "above" | "top-right" | "bottom-right" | "bottom-left" | "top-left";
  positionLocked?: boolean;
  onAddChild?: (id: string) => void;
  onAddBelow?: (id: string) => void;
  onAddAtPlacement?: (id: string, placement: MapNodeData["placement"]) => void;
  onToggle?: (id: string) => void;
  uiSelected?: boolean;
  childCount?: number;
  connectionTargetVisible?: boolean;
};

export type MapNode = Node<MapNodeData, "businessNode">;

export type StoredNode = {
  id: string;
  map_id: string;
  parent_id: string | null;
  heading: string;
  description: string;
  sort_order: number;
  position_x: number;
  position_y: number;
  collapsed: boolean;
  ai_solution: boolean;
  repeated_work: boolean;
  human_branch: boolean;
  human_ai_mix: boolean;
  tool_node: boolean;
  standalone_node: boolean;
  node_shape: "box" | "diamond" | "rounded" | "circle";
  node_color: "default" | "blue" | "yellow" | "rose" | "lavender" | "slate" | "red" | "green" | "orange" | "cyan" | "indigo";
  placement: "right" | "below" | "left" | "above" | "top-right" | "bottom-right" | "bottom-left" | "top-left";
  position_locked: boolean;
};

export type StoredConnection = {
  id: string;
  map_id: string;
  source_id: string;
  target_id: string;
  source_handle: string | null;
  target_handle: string | null;
};
