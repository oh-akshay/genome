import React, { useEffect, useMemo, useState } from "react";
import { loadActivities, loadDomainOrder, loadDomains, loadGenome, loadIcons } from "../dataLoader";
import { ActivitiesDoc, Genome, Node } from "../types";
import TreeCanvas from "./TreeCanvas";
import RecommendedLibrary from "./RecommendedLibrary";
import BaselineModal from "./BaselineModal";

export default function App() {
  const [activeChildId, setActiveChildId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('child');
    } catch { return null }
  });
  const initialFocusId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('focus');
    } catch { return null }
  }, []);
  const [genome, setGenome] = useState<Genome | null>(null);
  const [activities, setActivities] = useState<ActivitiesDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [domainOrder, setDomainOrder] = useState<Record<string, number>>({});
  const [domains, setDomains] = useState<Array<{ id: string; name: string; emoji?: string }>>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [childLevels, setChildLevels] = useState<Record<string, number>>({});
  const [childAge, setChildAge] = useState<number>(12);
  const [showPlan, setShowPlan] = useState(false);
  const [planItems, setPlanItems] = useState<Array<{ nodeId: string; activityId?: string }>>([]);
  const [planEnv, setPlanEnv] = useState<Array<'home'|'school'|'outdoors'>>(['home','school']);
  const [planMaxMin, setPlanMaxMin] = useState<number>(10);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [planExpanded, setPlanExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [childList, setChildList] = useState<Array<{ id:string; name:string; dob?:string }>>([]);
  const [milestoneTab, setMilestoneTab] = useState<'next'|'current'>('next');

  useEffect(() => {
    (async () => {
      try {
        const [g, a, ic, doms, domMeta] = await Promise.all([
          loadGenome(),
          loadActivities(),
          loadIcons(),
          loadDomainOrder(),
          loadDomains(),
        ]);
        setGenome(g);
        setActivities(a);
        setIcons(ic || {});
        const orderMap: Record<string, number> = {};
        (doms || []).forEach((id, i) => (orderMap[id] = i));
        setDomainOrder(orderMap);
        setDomains(domMeta || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load data");
      }
    })();
  }, []);

  // Load children metadata for dropdown; fallback to localStorage keys
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/data/metadata/children.json');
        if (resp.ok) {
          const j = await resp.json();
          const arr = Array.isArray(j?.children) ? j.children : [];
          setChildList(arr.map((c:any) => ({ id: c.childId, name: c.name || c.childId, dob: c.dob })));
          return;
        }
      } catch {}
      try {
        const found: Record<string, true> = {};
        for (let i=0; i<localStorage.length; i++){
          const k = localStorage.key(i) || '';
          const m = k.match(/^planner\.child\.(.+)\.levels$/);
          if (m) found[decodeURIComponent(m[1])] = true;
        }
        const list = Object.keys(found).map(id => ({ id, name: id }));
        setChildList(list);
      } catch {}
    })();
  }, []);

  // Accept initial focus from URL param to deep-link into a node
  useEffect(() => {
    if (initialFocusId) {
      setFocusId(initialFocusId);
      setSelectedId(initialFocusId);
    }
  }, [initialFocusId]);

  // Merge achievements overlay for active child into levels/completion
  useEffect(() => {
    function mergeOverlay(){
      try {
        if (!genome || !activeChildId) return;
        const raw = localStorage.getItem('planner.achieved.v1');
        if (!raw) return;
        const byChild = JSON.parse(raw || '{}') || {};
        const list: Array<{nodeId:string}> = byChild[activeChildId] || [];
        if (!Array.isArray(list)) return;
        const byId: Record<string, Node> = Object.fromEntries(genome.nodes.map(n=>[n.id, n]));
        const addWithParents = (id:string, out:Set<string>) => {
          let cur: Node | undefined = byId[id];
          while (cur) { out.add(cur.id); cur = cur.parentId ? byId[cur.parentId] : undefined; }
        };
        const expanded = new Set<string>();
        list.forEach(a => a?.nodeId && addWithParents(a.nodeId, expanded));
        setChildLevels(prev => {
          const next = { ...prev };
          expanded.forEach(id => { next[id] = Math.max(next[id] || 0, 3); });
          return next;
        });
      } catch {}
    }
    mergeOverlay();
    function onStorage(e: StorageEvent){ if (e.key === 'planner.achieved.v1') mergeOverlay(); }
    window.addEventListener('storage', onStorage);
    return ()=> window.removeEventListener('storage', onStorage);
  }, [genome, activeChildId]);

  // load/save completion state
  useEffect(() => {
    try {
      const raw = localStorage.getItem("completedNodes");
      if (raw) setCompleted(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("completedNodes", JSON.stringify(Array.from(completed)));
    } catch {}
  }, [completed]);

  // load/save child levels, age, and plan
  useEffect(() => {
    try {
      // Prefer per-child state if a child is specified
      if (activeChildId) {
        const lv = localStorage.getItem(`planner.child.${activeChildId}.levels`);
        if (lv) setChildLevels(JSON.parse(lv));
        const ag = localStorage.getItem(`planner.child.${activeChildId}.ageMonths`);
        if (ag) setChildAge(parseInt(ag) || 12);
      } else {
        const lv = localStorage.getItem("childLevels");
        if (lv) setChildLevels(JSON.parse(lv));
        const ag = localStorage.getItem("childAge");
        if (ag) setChildAge(parseInt(ag) || 12);
      }
      const pl = localStorage.getItem("sessionPlan");
      if (pl) setPlanItems(JSON.parse(pl));
    } catch {}
  }, [activeChildId]);
  useEffect(() => {
    try {
      if (activeChildId) localStorage.setItem(`planner.child.${activeChildId}.levels`, JSON.stringify(childLevels));
      else localStorage.setItem("childLevels", JSON.stringify(childLevels));
    } catch {}
  }, [childLevels, activeChildId]);
  useEffect(() => {
    try {
      if (activeChildId) localStorage.setItem(`planner.child.${activeChildId}.ageMonths`, String(childAge));
      else localStorage.setItem("childAge", String(childAge));
    } catch {}
  }, [childAge, activeChildId]);
  useEffect(() => { try { localStorage.setItem("sessionPlan", JSON.stringify(planItems)); } catch {} }, [planItems]);

  const selectedNode: Node | null = useMemo(() => {
    if (!genome || !selectedId) return null;
    return genome.nodes.find((n) => n.id === selectedId) || null;
  }, [genome, selectedId]);

  // Keep focus active to ensure ancestors expand and camera centers reliably

  // derive completed set from explicit completes + levels >=2
  const computedCompleted = useMemo(() => {
    const s = new Set<string>(Array.from(completed));
    for (const [id, lvl] of Object.entries(childLevels)) if (lvl >= 2) s.add(id);
    return s;
  }, [completed, childLevels]);

  // --- next milestones calculation ---
  function levelOf(id: string): number {
    if (childLevels[id] != null) return childLevels[id];
    return completed.has(id) ? 3 : 0;
  }
  function evalGateExpr(expr: string): boolean {
    try {
      const substituted = expr.replace(/level\('([^']+)'\)/g, (_: any, id: string) => String(levelOf(id)));
      if (!/^[-+*!<>=&|().\d\s]+$/.test(substituted)) return false;
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${substituted});`); return !!fn();
    } catch { return false }
  }
  function gatesAllow(n: Node): boolean {
    const gs: any = (n as any).gates; if (!gs || gs.length===0) return true;
    for (const g of gs) { if (g.kind === 'block' && evalGateExpr(g.expr)) return false }
    for (const g of gs) { if (g.kind === 'prereq' && !evalGateExpr(g.expr)) return false }
    return true
  }
  const nextMilestones: Node[] = useMemo(() => {
    if (!genome) return [];
    const byParent: Record<string, Node[]> = {};
    genome.nodes.forEach(n => { const k = n.parentId || ''; (byParent[k] ||= []).push(n); });
    const frontier = new Set<string>();
    // Unachieved immediate children of all achieved nodes
    computedCompleted.forEach(id => {
      const kids = byParent[id] || [];
      kids.forEach(k => { if (!computedCompleted.has(k.id)) frontier.add(k.id); });
    });
    const list = Array.from(frontier).map(id => genome.nodes.find(n => n.id === id)!).filter(Boolean) as Node[];
    return list.sort((a,b)=>{
      const as = a.ageBand?.typicalStart ?? 0;
      const bs = b.ageBand?.typicalStart ?? 0;
      const ae = a.ageBand?.typicalEnd ?? Number.POSITIVE_INFINITY;
      const be = b.ageBand?.typicalEnd ?? Number.POSITIVE_INFINITY;
      return (as - bs) || (ae - be) || a.name.localeCompare(b.name);
    });
  }, [genome, computedCompleted])

  const frontierIds = useMemo(
    () => (nextMilestones || []).map(n => n.id),
    [nextMilestones]
  );

  // Current abilities (Option 1: leaves-of-achieved)
  const currentAbilities: Node[] = useMemo(() => {
    if (!genome) return [];
    const byParent: Record<string, Node[]> = {};
    genome.nodes.forEach(n => { const k = n.parentId || ''; (byParent[k] ||= []).push(n); });
    const latest: string[] = [];
    computedCompleted.forEach(id => {
      const kids = byParent[id] || [];
      const anyAchievedChild = kids.some(k => computedCompleted.has(k.id));
      if (!anyAchievedChild) latest.push(id);
    });
    const list = latest.map(id => genome.nodes.find(n => n.id === id)!).filter(Boolean) as Node[];
    return list.sort((a,b)=>{
      const da = domainOrder[a.domain || ''] ?? 999;
      const db = domainOrder[b.domain || ''] ?? 999;
      const as = a.ageBand?.typicalStart ?? 0;
      const bs = b.ageBand?.typicalStart ?? 0;
      return da - db || as - bs || a.name.localeCompare(b.name);
    });
  }, [genome, computedCompleted, domainOrder]);

  // latest achieved by branch removed per request

  // Age-relevant milestones for rapid assessment
  const ageRelevant: Node[] = useMemo(() => {
    if (!genome) return [];
    return genome.nodes
      .filter(n => n.ageBand && childAge >= (n.ageBand!.typicalStart) && childAge <= (n.ageBand!.typicalEnd))
      .sort((a,b)=>{
        const da = domainOrder[a.domain || ''] ?? 999;
        const db = domainOrder[b.domain || ''] ?? 999;
        const as = a.ageBand!.typicalStart, bs = b.ageBand!.typicalStart;
        return da - db || as - bs || a.name.localeCompare(b.name);
      });
  }, [genome, childAge, domainOrder]);

  // search results (keep hooks before any early return)
  const searchResults = useMemo(() => {
    if (!genome) return [] as Node[];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Node[];
    const arr = genome.nodes.filter(n => n.name.toLowerCase().includes(q));
    return arr
      .sort((a,b)=> (a.ageBand?.typicalStart ?? 0) - (b.ageBand?.typicalStart ?? 0) || a.name.localeCompare(b.name))
      .slice(0,10);
  }, [genome, searchQuery]);

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui", color: "#b91c1c" }}>
        <h3>Failed to load data</h3>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{err}</div>
        <div style={{ marginTop: 8 }}>
          Check that these files exist and contain valid JSON:
          <ul>
            <li>public/data/genome.json</li>
            <li>public/data/activities/activities.json (or public/data/activities.json)</li>
          </ul>
          Then hard refresh (Cmd/Ctrl+Shift+R).
        </div>
      </div>
    );
  }

  if (!genome) {
    return <div style={{ padding: 16, fontFamily: "system-ui" }}>Loading…</div>;
  }

  const activityForSelected =
    selectedNode && activities
      ? activities.activities.filter((a) =>
          a.links?.some((l) => l.nodeId === selectedNode.id)
        )
      : [];

  // Search helpers
  const emojiFor = (n: Node): string => {
    if ((n as any).tags && (n as any).tags.length) {
      for (const t of (n as any).tags) {
        if ((icons as any)[t]) return (icons as any)[t];
      }
    }
    if ((n as any).domain && (icons as any)[(n as any).domain]) return (icons as any)[(n as any).domain];
    return "";
  };
  

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        height: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <TreeCanvas
        genome={genome}
        icons={icons}
        completed={computedCompleted}
        domainOrder={domainOrder}
        focusId={focusId}
        onSelect={(id) => setSelectedId(id)}
        selectedId={selectedId}
      />
      <aside
        style={{
          borderLeft: "1px solid #e5e7eb",
          padding: 12,
          overflow: "auto",
          background: "#fafafa",
        }}
      >
        {/* Search box */}
        <div style={{ position:'relative', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search milestones…"
            value={searchQuery}
            onChange={(e)=>{ setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={()=> setSearchOpen(true)}
            onKeyDown={(e)=>{
              if (e.key==='Escape'){ setSearchOpen(false); (e.target as HTMLInputElement).blur(); }
              if (e.key==='Enter' && searchResults.length>0){ const n=searchResults[0]; setSelectedId(n.id); setFocusId(n.id); setSearchOpen(false); }
            }}
            style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
          />
          {searchOpen && searchQuery.trim() && (
            <ul style={{ position:'absolute', zIndex:100, top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, margin:4, padding:4, listStyle:'none', maxHeight:260, overflow:'auto', boxShadow:'0 6px 24px rgba(0,0,0,0.12)' }}>
              {searchResults.length===0 && (
                <li style={{ padding:'8px 10px', color:'#6b7280', fontSize:12 }}>No matches</li>
              )}
              {searchResults.map(n => (
                <li key={n.id}
                    onMouseDown={(e)=>{ e.preventDefault(); setSelectedId(n.id); setFocusId(n.id); setSearchOpen(false); }}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', cursor:'pointer', borderRadius:6 }}
                    onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.background = '#f3f4f6' }}
                    onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span style={{ fontSize:16 }}>{emojiFor(n)}</span>
                  <div style={{ display:'grid' }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{n.name} {n.ageBand && (<span style={{ fontWeight:400, color:'#6b7280' }}>({n.ageBand.typicalStart}–{n.ageBand.typicalEnd}m)</span>)}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>{n.domain || ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

          <div style={{ display:'grid', gap:8, marginBottom:8 }}>
            <div style={{ display:'flex', gap:8 }}>
              <label style={{ flex:1 }}>
                <span style={{ fontSize:12, color:'#6b7280' }}>Child</span>
                <select value={activeChildId || ''} onChange={e => {
                  const id = e.target.value || null;
                  setActiveChildId(id);
                  try {
                    const url = new URL(window.location.href);
                    if (id) url.searchParams.set('child', id); else url.searchParams.delete('child');
                    window.history.replaceState({}, '', url.toString());
                  } catch {}
                }} style={{ width:'100%', padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8 }}>
                  <option value="">(none)</option>
                  {childList.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </label>
            <button className="btn" style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', alignSelf:'end' }} onClick={() => setShowPlan(true)}>Plan</button>
            <button className="btn" style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', alignSelf:'end' }} onClick={() => setShowBaseline(true)}>Evaluate</button>
            <button className="btn" style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', alignSelf:'end' }} onClick={() => setShowLegend(true)}>Legend</button>
          </div>
          {/* Latest achieved by branch intentionally removed */}
        </div>
        
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fff", marginBottom: 12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
            <div style={{ fontWeight: 700 }}>{milestoneTab==='next' ? 'Next milestones' : 'Current abilities'}</div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setMilestoneTab('next')} style={{ border:'1px solid #e5e7eb', background: milestoneTab==='next' ? '#111827' : '#fff', color: milestoneTab==='next' ? '#fff' : '#111827', borderRadius:8, padding:'4px 8px', cursor:'pointer' }}>Next</button>
              <button onClick={()=>setMilestoneTab('current')} style={{ border:'1px solid #e5e7eb', background: milestoneTab==='current' ? '#111827' : '#fff', color: milestoneTab==='current' ? '#fff' : '#111827', borderRadius:8, padding:'4px 8px', cursor:'pointer' }}>Current</button>
            </div>
          </div>
          {(() => {
            const list = milestoneTab==='next' ? nextMilestones : currentAbilities;
            if (list.length===0) return (<div style={{ color: '#6b7280', fontSize: 13 }}>No items yet.</div>);
            return (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {list.slice(0,6).map(n => (
                  <li key={n.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, background: '#f8fafc', cursor: 'pointer' }} onClick={() => { setSelectedId(n.id); setFocusId(n.id); }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {n.name}
                      {n.ageBand && (
                        <span style={{ marginLeft: 6, fontSize: 12, color: '#6b7280' }}>
                          ({n.ageBand.typicalStart}–{n.ageBand.typicalEnd}m)
                        </span>
                      )}
                    </div>
                    {milestoneTab==='next' && activities?.activities && (() => {
                      const acts = activities.activities.filter(a => a.links?.some(l => l.nodeId===n.id)).slice(0,2)
                      if (acts.length===0) return null
                      return (
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {acts.map(a => (
                            <span key={a.id} style={{ fontSize: 12, background: '#eef2ff', color: '#3730a3', border: '1px solid #e0e7ff', borderRadius: 999, padding: '2px 8px' }}>
                              {a.emoji ? a.emoji+' ' : ''}{a.title}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
        <h3 style={{ margin: "8px 0" }}>
          {selectedNode ? selectedNode.name : "Select a milestone"}
        </h3>
        {selectedNode && selectedNode.description && (
          <p style={{ marginTop: 4, color: "#374151" }}>
            {selectedNode.description}
          </p>
        )}
        {selectedNode?.ageBand && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            Age band: {selectedNode.ageBand.typicalStart}–{selectedNode.ageBand.typicalEnd} months
          </div>
        )}
        {selectedNode && (
          (() => {
            const byId: Record<string, Node> = Object.fromEntries(genome.nodes.map(n => [n.id, n]))
            const parents: Node[] = []
            let cur: Node | undefined = selectedNode
            while (cur && cur.parentId){ cur = byId[cur.parentId]; if(cur) parents.unshift(cur) }
            const children = genome.nodes.filter(n => n.parentId === selectedNode.id).sort((a,b)=> (a.ageBand?.typicalStart ?? 0) - (b.ageBand?.typicalStart ?? 0))
            return (
              <div style={{ marginTop: 10 }}>
                {parents.length>0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Parents</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {parents.map(p => (
                        <span key={p.id} className="pill" style={{ background:'#f8fafc' }} onClick={()=> { setSelectedId(p.id); setFocusId(p.id); }}>{p.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Next children</div>
                  {children.length===0 ? (
                    <div style={{ color:'#6b7280', fontSize:12 }}>No direct children.</div>
                  ) : (
                    <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:6 }}>
                      {children.map(c => (
                        <li key={c.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button className="btn" style={{ background:'#e5e7eb', color:'#111', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=> { setSelectedId(c.id); setFocusId(c.id); }}>Open</button>
                          <div style={{ fontSize:13, fontWeight:600, flex:1 }}>{c.name}</div>
                          {c.ageBand && (<span className="badge">{c.ageBand.typicalStart}–{c.ageBand.typicalEnd}m</span>)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()
        )}
        {selectedNode && selectedNode.ageBand && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Current level: {Number(levelOf(selectedNode.id)).toFixed(1)}</div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.5}
              value={levelOf(selectedNode.id)}
              onChange={e => {
                const val = parseFloat(e.target.value);
                setChildLevels(prev => {
                  const next = { ...prev, [selectedNode.id]: val } as Record<string, number>;
                  // If mastered (3), mark all parents mastered too (same as evaluation modal)
                  if (val >= 3) {
                    try {
                      const byId: Record<string, Node> = Object.fromEntries(genome!.nodes.map(n => [n.id, n]));
                      let cur: Node | undefined = selectedNode;
                      while (cur && cur.parentId) {
                        const p = byId[cur.parentId];
                        if (!p) break;
                        next[p.id] = 3;
                        cur = p;
                      }
                    } catch {}
                  }
                  return next;
                });
              }}
            />
            <div style={{ fontSize: 12, color: '#6b7280' }}>0 = not yet, 1 = emerging, 2 = consistent, 3 = mastered</div>
          </div>
        )}
        {selectedNode?.exitCriteria && selectedNode.exitCriteria.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              Exit criteria
            </div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {selectedNode.exitCriteria.map((e) => (
                <li key={e} style={{ fontSize: 13, color: "#374151" }}>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activityForSelected && activityForSelected.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              Recommended activities
            </div>
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
              {activityForSelected.map((a) => (
                <li
                  key={a.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {a.emoji ? a.emoji + " " : ""}
                    {a.title}
                  </div>
                  {a.steps?.length ? (
                    <ol style={{ margin: "4px 0 0 16px", fontSize: 13 }}>
                      {a.steps.map((s, i) => (
                        <li key={i}>{s.text}</li>
                      ))}
                    </ol>
                  ) : null}
                  {a.links?.length ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      Meets:{" "}
                      {a.links
                        .filter((l) => l.nodeId === selectedNode?.id)
                        .map((l) => l.meetsExit)
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      {showPlan && (
        <div role="dialog" aria-modal="true" aria-label="Planning" onClick={() => setShowPlan(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:16, width:720, maxHeight:'84vh', overflow:'auto', boxShadow:'0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin:0 }}>Session Planner</h3>
              <button className="btn" style={{ background:'#e5e7eb', color:'#111', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=>setShowPlan(false)}>Close</button>
            </div>
            <div style={{ display:'grid', gap:12, marginTop:12 }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <label style={{ fontWeight:600 }}>Age (months)</label>
                <input type="number" min={0} max={60} value={childAge} onChange={e=>setChildAge(parseInt(e.target.value)||0)} style={{ width:80 }} />
              </div>
              <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10 }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>Assess this month</div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Set current level for milestones typical at {childAge}m. 0 = not yet, 1 = emerging, 2 = consistent, 3 = mastered.</div>
                {ageRelevant.length === 0 ? (
                  <div style={{ color:'#6b7280', fontSize:13 }}>No milestones match this month. Try adjusting age.</div>
                ) : (
                  <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:10 }}>
                    {ageRelevant.map(n => {
                      const icon = (()=>{
                        if (n.tags && n.tags.length) { for (const t of n.tags) { if ((icons as any)[t]) return (icons as any)[t] } }
                        if (n.domain && (icons as any)[n.domain]) return (icons as any)[n.domain];
                        return '';
                      })();
                      const isOpen = planExpanded.has(n.id);
                      return (
                      <li key={n.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:8, background:'#f8fafc' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button aria-label={isOpen? 'Collapse':'Expand'} onClick={()=> setPlanExpanded(prev => { const s=new Set(prev); s.has(n.id)? s.delete(n.id): s.add(n.id); return s; })} style={{ border:0, background:'transparent', cursor:'pointer', fontSize:16, lineHeight:1 }}>{isOpen?'▾':'▸'}</button>
                          <div style={{ fontWeight:600, fontSize:13, flex:1 }}>{icon? icon+' ' : ''}{n.name}</div>
                          <div style={{ display:'flex', gap:6 }}>
                            {[0,1,2,3].map(v => (
                              <button key={v} className="btn" style={{ background: (childLevels[n.id]??0)===v? '#111827':'#e5e7eb', color:(childLevels[n.id]??0)===v? '#fff':'#111', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=> setChildLevels(prev => ({ ...prev, [n.id]: v }))}>{v}</button>
                            ))}
                          </div>
                          <button className="btn" style={{ background:'#111827', color:'#fff', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=> { setSelectedId(n.id); setFocusId(n.id); setShowPlan(false); }}>Open in graph</button>
                        </div>
                        {isOpen && (
                          <div style={{ marginTop:8, fontSize:13, color:'#374151' }}>
                            {n.ageBand && (<div style={{ marginBottom:4 }}><b>Age:</b> {n.ageBand.typicalStart}–{n.ageBand.typicalEnd}m</div>)}
                            {n.exitCriteria && n.exitCriteria.length>0 && (
                              <div style={{ marginTop:4 }}>
                                <div style={{ fontWeight:600 }}>Exit criteria</div>
                                <ul style={{ margin:0, paddingLeft:16 }}>
                                  {n.exitCriteria.map((e,i)=>(<li key={i}>{e}</li>))}
                                </ul>
                              </div>
                            )}
                            {n.description && (<div style={{ marginTop:6 }}>{n.description}</div>)}
                          </div>
                        )}
                      </li>
                      )})}
                  </ul>
                )}
              </div>

              <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontWeight:700 }}>Activities for this month</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#6b7280' }}>Env:</span>
                    {(['home','school','outdoors'] as const).map(env => (
                      <button key={env} className="btn" style={{ background: planEnv.includes(env)? '#111827':'#e5e7eb', color: planEnv.includes(env)? '#fff':'#111', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=> setPlanEnv(prev => prev.includes(env)? prev.filter(e=>e!==env) : [...prev, env])}>{env}</button>
                    ))}
                    <span style={{ fontSize:12, color:'#6b7280', marginLeft:8 }}>≤ {planMaxMin} min</span>
                    <input type="range" min={3} max={20} step={1} value={planMaxMin} onChange={e=> setPlanMaxMin(parseInt(e.target.value))} />
                  </div>
                </div>
                <ul style={{ listStyle:'none', padding:0, marginTop:8, display:'grid', gap:10 }}>
                  {ageRelevant.filter(n => (childLevels[n.id]??0) < 2).map(n => {
                    const acts = (activities?.activities||[])
                      .filter(a => a.links?.some(l => l.nodeId===n.id))
                      .filter(a => !a.environment || a.environment.some(e => planEnv.includes(e)))
                      .filter(a => !a.durationMin || a.durationMin <= planMaxMin)
                      .slice(0,3)
                    return (
                      <li key={n.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:8 }}>
                        <div style={{ fontWeight:600, fontSize:13, marginBottom:6 }}>{n.name}</div>
                        {acts.length===0 ? (
                          <div style={{ color:'#6b7280', fontSize:12 }}>No matching activities under current filters.</div>
                        ) : (
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                            {acts.map(a => (
                              <button key={a.id} className="btn" style={{ background:'#10b981', border:0, borderRadius:8, padding:'4px 8px', color:'#fff', cursor:'pointer' }} onClick={()=> setPlanItems(prev => prev.some(p=>p.nodeId===n.id && p.activityId===a.id)? prev : [...prev, { nodeId:n.id, activityId:a.id }])}>
                                {a.emoji ? a.emoji+' ' : ''}{a.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontWeight:700 }}>Today's Plan</div>
                  {/* ---- Recommended Library (frontier-based) ---- */}
                  <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10, marginTop:12 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ fontWeight:700 }}>Recommended for Current Progress</div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>
                        Based on your next milestones ({frontierIds.length})
                      </div>
                    </div>
                    <div style={{ marginTop:8 }}>
                      <RecommendedLibrary
                        activities={activities}
                        frontierIds={frontierIds}
                        onAdd={(activityId, targetNodeId) => {
                          // avoid duplicates (same node + activity)
                          setPlanItems(prev =>
                            prev.some(p => p.nodeId === targetNodeId && p.activityId === activityId)
                              ? prev
                              : [...prev, { nodeId: targetNodeId, activityId }]
                          );
                        }}
                      />
                    </div>
                  </div>
                  {planItems.length>0 && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn" style={{ background:'#111827', color:'#fff', border:0, borderRadius:8, padding:'6px 10px', cursor:'pointer' }} onClick={()=>{
                        const payload = planItems.map(p=>({ nodeId:p.nodeId, activityId:p.activityId }))
                        const blob = new Blob([JSON.stringify({ date:new Date().toISOString().slice(0,10), ageMonths: childAge, items: payload }, null, 2)], { type:'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a'); a.href=url; a.download='session-plan.json'; a.click(); URL.revokeObjectURL(url)
                      }}>Export JSON</button>
                      <button className="btn" style={{ background:'#e11d48', color:'#fff', border:0, borderRadius:8, padding:'6px 10px', cursor:'pointer' }} onClick={()=> setPlanItems([])}>Clear</button>
                    </div>
                  )}
                </div>
                {planItems.length===0 ? (
                  <div style={{ color:'#6b7280', fontSize:13, marginTop:6 }}>No items yet. Use "Add" under Suggested targets.</div>
                ) : (
                  <ul style={{ listStyle:'none', padding:0, marginTop:8, display:'grid', gap:8 }}>
                    {planItems.map((p, idx) => {
                      const node = genome.nodes.find(n=>n.id===p.nodeId)
                      const acts = activities?.activities.filter(a=> a.links?.some(l=>l.nodeId===p.nodeId)) || []
                      return (
                        <li key={p.nodeId} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:8, background:'#f8fafc' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <div style={{ fontWeight:600, flex:1 }}>{node?.name || p.nodeId}</div>
                            <select value={p.activityId || ''} onChange={e=> setPlanItems(prev => prev.map((x,i)=> i===idx ? { ...x, activityId: e.target.value || undefined } : x))}>
                              <option value="">Choose activity…</option>
                              {acts.map(a => (<option key={a.id} value={a.id}>{a.emoji? a.emoji+' ' : ''}{a.title}</option>))}
                            </select>
                            <button className="btn" style={{ background:'#e11d48', color:'#fff', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={()=> setPlanItems(prev => prev.filter((x)=> x.nodeId!==p.nodeId))}>Remove</button>
                          </div>
                          {p.activityId && (
                            <div style={{ marginTop:6, fontSize:12, color:'#374151' }}>
                              {acts.find(a=>a.id===p.activityId)?.steps?.slice(0,3)?.map((s,i)=>(<div key={i}>• {s.text}</div>))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showLegend && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Legend"
          onClick={() => setShowLegend(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 16, width: 420, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin: 0 }}>Legend</h3>
              <button className="btn" style={{ background:'#e5e7eb', color:'#111', border:0, borderRadius:8, padding:'4px 8px', cursor:'pointer' }} onClick={() => setShowLegend(false)}>Close</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>Icons map to domains via metadata/icons.json; custom tags can override per node.</div>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display:'grid', gap:8 }}>
              {domains.map(d => {
                const icon = (icons && icons[d.id]) || d.emoji || '•'
                return (
                  <li key={d.id} style={{ display:'flex', alignItems:'center', gap:10, border:'1px solid #e5e7eb', borderRadius:10, padding:8, background:'#f8fafc' }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div style={{ display:'grid' }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{d.id}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
      {showBaseline && (
        <BaselineModal
          open={showBaseline}
          onClose={()=>setShowBaseline(false)}
          genome={genome}
          childId={activeChildId}
          icons={icons}
          onSaved={()=>{
            try{
              if (!activeChildId) return;
              const lv = localStorage.getItem(`planner.child.${activeChildId}.levels`);
              if (lv) setChildLevels(JSON.parse(lv));
            }catch{}
          }}
        />
      )}
    </div>
  );
}
