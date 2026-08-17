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
  toolNode?: boolean;
  standaloneNode?: boolean;
  shape: "box" | "diamond" | "rounded";
  color: "default" | "blue" | "yellow" | "rose" | "lavender" | "slate";
  placement: "right" | "below";
  positionLocked?: boolean;
  onAddChild?: (id: string) => void;
  onAddBelow?: (id: string) => void;
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
  tool_node: boolean;
  standalone_node: boolean;
  node_shape: "box" | "diamond" | "rounded";
  node_color: "default" | "blue" | "yellow" | "rose" | "lavender" | "slate";
  placement: "right" | "below";
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
