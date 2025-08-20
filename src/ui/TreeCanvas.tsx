import React, { useEffect, useMemo, useRef, useState } from "react";
import { Edge, Genome, Node } from "../types";

// simple tree building
function buildChildrenIndex(nodes: Node[]): Map<string | null, Node[]> {
  const map = new Map<string | null, Node[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return map;
}

type Props = {
  genome: Genome;
  icons: Record<string, string>;
  domainOrder: Record<string, number>;
  completed: Set<string>;
  onSelect: (nodeId: string) => void;
  selectedId: string | null;
  focusId?: string | null;
};

type Camera = { x: number; y: number; k: number };

const NODE_W = 220;
const NODE_H = 64;
const X_GAP = 48;
const Y_GAP = 18;
const LAYER_GAP = 80;

export default function TreeCanvas({ genome, icons, domainOrder, completed, onSelect, selectedId, focusId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 });

  // Expanded state: collapse all by default except the root
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const roots = genome.ladders.map((l) => l.rootNodeId);
    roots.forEach((r) => s.add(r));
    return s;
  });

  const nodesById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of genome.nodes) m.set(n.id, n);
    return m;
  }, [genome.nodes]);

  const childrenIndex = useMemo(() => buildChildrenIndex(genome.nodes), [genome.nodes]);

  const roots = useMemo(() => {
    return genome.ladders
      .map((l) => nodesById.get(l.rootNodeId))
      .filter(Boolean) as Node[];
  }, [genome.ladders, nodesById]);

  // Expand ancestors to ensure focusId becomes visible
  useEffect(() => {
    if (!focusId) return;
    const target = nodesById.get(focusId);
    if (!target) return;
    setExpanded((prev) => {
      const s = new Set(prev);
      let cur: Node | undefined = target;
      while (cur && cur.parentId) {
        s.add(cur.parentId);
        cur = nodesById.get(cur.parentId);
      }
      return s;
    });
  }, [focusId, nodesById]);

  // layout (hierarchical, respecting collapse)
  const layout = useMemo(() => {
    let yCursor = 0;
    const positions = new Map<string, { x: number; y: number }>();
    const visible: Node[] = [];

    function layoutSubtree(node: Node, depth: number): number {
      const kids = (childrenIndex.get(node.id) || []).slice();
      const parentIsRoot = roots.some((r) => r.id === node.id);
      kids.sort((a, b) => {
        if (parentIsRoot) {
          const ra = domainOrder[a.domain || ""] ?? 999;
          const rb = domainOrder[b.domain || ""] ?? 999;
          return ra - rb || (a.name || "").localeCompare(b.name || "");
        }
        const as = a.ageBand?.typicalStart ?? 0;
        const bs = b.ageBand?.typicalStart ?? 0;
        return as - bs || a.name.localeCompare(b.name);
      });
      const isOpen = expanded.has(node.id);
      const myY = yCursor;
      visible.push(node);
      positions.set(node.id, { x: depth * (NODE_W + LAYER_GAP), y: myY });
      yCursor += NODE_H + Y_GAP;

      if (isOpen && kids.length) {
        for (const child of kids) {
          layoutSubtree(child, depth + 1);
        }
      }
      return myY;
    }

    let maxX = 0;
    let maxY = 0;

    for (const r of roots) {
      layoutSubtree(r, 0);
      yCursor += NODE_H; // extra space between roots
    }

    for (const { x, y } of positions.values()) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    return {
      positions,
      visible,
      bounds: { x: 0, y: 0, w: maxX + NODE_W, h: maxY + NODE_H },
    };
  }, [roots, childrenIndex, expanded]);

  // panning/zooming
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let dragging = false;
    let last = { x: 0, y: 0 };

    function mousedown(e: MouseEvent) {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
    }
    function mousemove(e: MouseEvent) {
      if (!dragging) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    }
    function mouseup() {
      dragging = false;
    }
    function wheel(e: WheelEvent) {
      e.preventDefault();
      const scale = Math.exp(-e.deltaY * 0.001); // smooth zoom
      setCam((c) => {
        const k = Math.min(2.5, Math.max(0.4, c.k * scale));
        return { ...c, k };
      });
    }

    el.addEventListener("mousedown", mousedown);
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup);
    el.addEventListener("wheel", wheel, { passive: false });

    return () => {
      el.removeEventListener("mousedown", mousedown);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mouseup", mouseup);
      el.removeEventListener("wheel", wheel as any);
    };
  }, []);

  // click picking (toggle expand / select)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const elSafe = el; // capture non-null for closures
    function worldFromClient(clientX: number, clientY: number) {
      const rect = elSafe.getBoundingClientRect();
      const x = (clientX - rect.left - cam.x) / cam.k;
      const y = (clientY - rect.top - cam.y) / cam.k;
      return { x, y };
    }

    function onclick(e: MouseEvent) {
      const pt = worldFromClient(e.clientX, e.clientY);

      // detect chevron hit on any visible node
      for (const n of layout.visible) {
        const p = layout.positions.get(n.id)!;
        const cx = p.x + 12;
        const cy = p.y + NODE_H / 2;
        const r = 10;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        if (dx * dx + dy * dy <= r * r) {
          // toggle
          setExpanded((s) => {
            const ns = new Set(s);
            if (ns.has(n.id)) ns.delete(n.id);
            else ns.add(n.id);
            return ns;
          });
          return;
        }
      }

      // detect node click
      for (const n of layout.visible) {
        const p = layout.positions.get(n.id)!;
        if (
          pt.x >= p.x &&
          pt.x <= p.x + NODE_W &&
          pt.y >= p.y &&
          pt.y <= p.y + NODE_H
        ) {
          if ((n as Node).ageBand) onSelect(n.id);
          return;
        }
      }
    }

    elSafe.addEventListener("click", onclick);
    return () => elSafe.removeEventListener("click", onclick);
  }, [layout, cam, onSelect]);

  // draw
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    const cw = el.clientWidth * DPR;
    const ch = el.clientHeight * DPR;
    if (el.width !== cw || el.height !== ch) {
      el.width = cw;
      el.height = ch;
    }

    ctx.save();
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, el.clientWidth, el.clientHeight);

    // world transform
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.k, cam.k);

    // draw tree edges (parent→child) as light lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1.2;
      for (const n of layout.visible) {
        if (!n.parentId) continue;
        const a = layout.positions.get(n.parentId);
        const b = layout.positions.get(n.id);
        if (!a || !b) continue;
      const ax = a.x + NODE_W;
      const ay = a.y + NODE_H / 2;
      const bx = b.x;
      const by = b.y + NODE_H / 2;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      // elbow
      const mx = (ax + bx) / 2;
      ctx.lineTo(mx, ay);
      ctx.lineTo(mx, by);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // draw cross-domain edges (dashed)
    if (genome.edges && genome.edges.length) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 1;
      for (const e of genome.edges) {
        const a = layout.positions.get(e.source);
        const b = layout.positions.get(e.target);
        if (!a || !b) continue;
        const ax = a.x + NODE_W / 2;
        const ay = a.y + NODE_H / 2;
        const bx = b.x + NODE_W / 2;
        const by = b.y + NODE_H / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }

    // helper: pick emoji by tags/domain
    const emojiFor = (n: Node): string | null => {
      if (n.tags && n.tags.length) {
        for (const t of n.tags) {
          if (icons[t]) return icons[t];
        }
      }
      if (n.domain && icons[n.domain]) return icons[n.domain];
      return null;
    };

    // draw nodes
      for (const n of layout.visible) {
        const p = layout.positions.get(n.id)!;
        const isSelected = selectedId === n.id;
        const isDone = completed.has(n.id);

      // card
      ctx.fillStyle = isDone ? "#ecfdf5" : isSelected ? "#eef2ff" : "#ffffff";
      ctx.strokeStyle = isDone ? "#10b981" : isSelected ? "#6366f1" : "#d1d5db";
      ctx.lineWidth = isSelected || isDone ? 2 : 1;
      roundRect(ctx, p.x, p.y, NODE_W, NODE_H, 12);
      ctx.fill();
      ctx.stroke();

      // chevron circle
      const hasKids = (childrenIndex.get(n.id) || []).length > 0;
      if (hasKids) {
        const cx = p.x + 12;
        const cy = p.y + NODE_H / 2;
        ctx.fillStyle = expanded.has(n.id) ? "#10b981" : "#9ca3af";
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();

        // chevron
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(expanded.has(n.id) ? "–" : "+", cx, cy + 0.5);
      }

      // title with emoji
      ctx.fillStyle = "#111827";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const padX = 30;
      const padY = 10;
      const prefix = emojiFor(n);
      const title = (prefix ? prefix + " " : "") + n.name;
      wrapText(ctx, title, p.x + padX, p.y + padY, NODE_W - padX - 10, 16);

      // age badge
      if (n.ageBand) {
        const txt = `${n.ageBand.typicalStart}–${n.ageBand.typicalEnd}m`;
        ctx.fillStyle = "#065f46";
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(txt, p.x + padX, p.y + NODE_H - 10);
      }
    }

    ctx.restore();
  }, [cam, genome.edges, layout, selectedId, childrenIndex, icons, completed]);

  // Autofocus on selected/focused node
  useEffect(() => {
    const id = focusId || selectedId;
    if (!id) return;
    const p = layout.positions.get(id);
    const el = canvasRef.current;
    if (!p || !el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setCam((c) => ({ ...c, x: cx - (p.x + NODE_W / 2) * c.k, y: cy - (p.y + NODE_H / 2) * c.k }));
  }, [focusId, selectedId, layout]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", background: "#f8fafc", cursor: "grab" }}
    />
  );
}

// utils
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trimEnd(), x, yy);
      line = words[n] + " ";
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line.trimEnd(), x, yy);
}
