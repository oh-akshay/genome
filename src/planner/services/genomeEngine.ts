// ---------- Types ----------
export type Node = {
  id: string;
  name: string;
  tags?: string[];
  ageBand?: { typicalStart?: number; typicalEnd?: number };
};

export type Edge = { from: string; to: string; type?: string };

export type Genome = {
  nodes: Node[];
  edges: Edge[];
  ladders?: { id: string; name: string; roots: string[] }[]; // optional
};

export type Achievement = { nodeId: string; at?: string; evidenceId?: string };
export type ChildAchievements = Record<string, Achievement[]>; // childId -> list

// ---------- Index ----------
export type GenomeIndex = {
  nodeById: Record<string, Node>;
  children: Record<string, string[]>;
  parent: Record<string, string|null>;
  roots: string[];                 // forest roots
  rootFor: Record<string, string>; // nodeId -> rootId
  depth: Record<string, number>;
};

export function buildGenomeIndex(g: Genome): GenomeIndex {
  const nodeById: Record<string, Node> = {};
  g.nodes.forEach(n => (nodeById[n.id] = n));

  const children: Record<string, string[]> = {};
  const indeg: Record<string, number> = {};
  const parent: Record<string, string|null> = {};
  Object.keys(nodeById).forEach(id => { children[id] = []; indeg[id] = 0; parent[id] = null; });

  // Use forward edges as progression; ignore non-progression if your edges have types
  for (const e of g.edges) {
    // If your graph encodes other relations, filter by e.type === 'next' or similar
    if (!nodeById[e.from] || !nodeById[e.to]) continue;
    children[e.from].push(e.to);
    indeg[e.to] = (indeg[e.to] ?? 0) + 1;
    parent[e.to] = e.from; // ASSUMPTION: single parent (tree). If multiple, choose the primary progression edge.
  }

  const roots = Object.keys(indeg).filter(id => (indeg[id] || 0) === 0);
  const depth: Record<string, number> = {};
  const rootFor: Record<string, string> = {};

  // BFS from each root to assign depth & rootFor
  for (const r of roots) {
    const q = [[r, 0]];
    rootFor[r] = r; depth[r] = 0;
    while (q.length) {
      const [id, d] = q.shift()!;
      for (const ch of children[id]) {
        if (depth[ch] === undefined || d + 1 < depth[ch]) depth[ch] = d + 1;
        if (!rootFor[ch]) rootFor[ch] = r;
        q.push([ch, d + 1]);
      }
    }
  }

  return { nodeById, children, parent, roots, rootFor, depth };
}

// ---------- Child derivation ----------
export type DerivedBranch = {
  rootId: string;
  latestAchieved: string | null;  // LAA
  frontier: string[];             // next candidates (children of LAA or root)
};

export type DerivedState = {
  achievedSet: Set<string>;
  branches: DerivedBranch[];
  frontierAll: string[];          // union of all branch frontiers
};

export function deriveStateForChild(index: GenomeIndex, childAchieved: Achievement[]): DerivedState {
  const achievedSet = new Set<string>(childAchieved.map(a => a.nodeId));
  const byRoot: Record<string, string[]> = {};
  // group nodes by root (branch)
  for (const id of Object.keys(index.nodeById)) {
    const r = index.rootFor[id];
    if (!r) continue;
    (byRoot[r] ||= []).push(id);
  }
  // sort each branch by depth (root->leaves)
  for (const r of Object.keys(byRoot)) {
    byRoot[r].sort((a,b) => (index.depth[a]||0) - (index.depth[b]||0));
  }

  const branches: DerivedBranch[] = [];
  for (const root of index.roots) {
    const chain = byRoot[root] || [root];
    // find deepest achieved node along this chain
    let laa: string | null = null;
    for (const n of chain) {
      if (achievedSet.has(n)) laa = n; else {
        // stop at first not achieved along sorted chain
        break;
      }
    }
    let frontier: string[] = [];
    if (laa) {
      frontier = index.children[laa] || [];
    } else {
      // nothing achieved on this branch: start at root
      frontier = [root];
      // If root is a meta/root placeholder and actual progression starts at its children, switch to children
      if ((index.children[root] || []).length > 0) frontier = index.children[root];
    }
    branches.push({ rootId: root, latestAchieved: laa, frontier });
  }

  const frontierAll = Array.from(new Set(branches.flatMap(b => b.frontier)));
  return { achievedSet, branches, frontierAll };
}