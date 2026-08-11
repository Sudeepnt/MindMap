import type { Node } from "@xyflow/react";

export type MapNodeData = {
  heading: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
  collapsed: boolean;
  aiSolution: boolean;
  repeatedWork: boolean;
  onAddChild?: (id: string) => void;
  onAddSibling?: (id: string) => void;
  onToggle?: (id: string) => void;
  childCount?: number;
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
};
