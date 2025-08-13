export type AgeBand = {
  typicalStart: number; // months
  typicalEnd: number;   // months
};

export type Gate = {
  kind: "prereq" | "boost" | "block";
  expr: string;              // simple boolean expression (see logic.ts)
  rationale?: string;
};

export type Node = {
  id: string;
  ladderId: string;
  domain?: string;          // still supported for coloring
  parentId: string | null;  // tree parent (single parent)
  name: string;
  description?: string;
  ageBand?: AgeBand;
  exitCriteria?: string[];
  tags?: string[];
  gates?: Gate[];
};

export type Ladder = {
  id: string;
  name: string;
  rootNodeId: string;
};

export type Edge = {
  source: string;                 // node.id
  target: string;                 // node.id
  kind?: "gate" | "related" | "prereq";
  style?: "cross" | "intra";
  rationale?: string;
};

export type Genome = {
  meta: Record<string, any>;
  ladders: Ladder[];
  nodes: Node[];
  edges?: Edge[];                 // optional
};

export type ActivityLink = {
  nodeId: string;
  meetsExit?: string;
};

export type Activity = {
  id: string;
  title: string;
  emoji?: string;
  environment?: Array<"home" | "school" | "outdoors">;
  durationMin?: number;
  materials?: Array<{ name: string }>;
  steps: Array<{ text: string }>;
  observe?: string[];
  links: ActivityLink[];
  tags?: string[];
};

export type ActivitiesDoc = {
  activities: Activity[];
};

// UI view models
export type ChildNode = Node & {
  children: Node[];
};

export type LayoutPoint = { x: number; y: number };

export type LayoutResult = {
  positions: Map<string, LayoutPoint>; // nodeId -> position
  bounds: { x: number; y: number; w: number; h: number };
};