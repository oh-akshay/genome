import React from 'react';
import type { Genome, Node } from '../types';

type EvalState = 0|1|2; // 0=Not observed, 1=Emerging, 2=Achieved

function buildParentMap(nodes: Node[]): Record<string, string|null> {
  const map: Record<string, string|null> = {};
  nodes.forEach(n => { map[n.id] = n.parentId; });
  return map;
}

function expandWithParents(id: string, parentMap: Record<string, string|null>): string[] {
  const out: string[] = [];
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)){
    seen.add(cur);
    out.push(cur);
    cur = parentMap[cur] || null;
  }
  return out;
}

function bucketize(maxEnd: number, step = 3){
  const buckets: Array<{start:number; end:number; label:string}> = [];
  const end = Math.max(step, Math.ceil(maxEnd/step)*step);
  for (let s=0; s<end; s+=step){
    const e = s + step;
    buckets.push({ start:s, end:e, label:`${s}–${e}m` });
  }
  return buckets;
}

export default function BaselineModal({ open, onClose, genome, childId, icons, onSaved }:{ open:boolean; onClose:()=>void; genome: Genome; childId: string|null; icons: Record<string,string>; onSaved?: ()=>void }){
  const [evalMap, setEvalMap] = React.useState<Record<string, EvalState>>({});
  const [search, setSearch] = React.useState('');
  const [tagNames, setTagNames] = React.useState<Record<string,string>>({});

  const nodes = genome?.nodes || [];
  const parentMap = React.useMemo(()=> buildParentMap(nodes), [nodes]);
  const maxEnd = React.useMemo(()=> nodes.reduce((m,n)=> Math.max(m, n.ageBand?.typicalEnd ?? 0), 0), [nodes]);
  const buckets = React.useMemo(()=> bucketize(maxEnd, 3), [maxEnd]);

  // Build tag list
  const tags: string[] = React.useMemo(()=>{
    const s = new Set<string>();
    nodes.forEach(n => (n.tags||[]).forEach(t=> s.add(t)));
    return Array.from(s).sort((a,b)=> a.localeCompare(b));
  }, [nodes]);

  // Load/save evaluation from localStorage
  React.useEffect(()=>{
    if (!childId) return;
    try {
      // start from existing saved eval (if any)
      const rawEval = localStorage.getItem(`planner.eval.${childId}`);
      const savedEval: Record<string, EvalState> = rawEval ? JSON.parse(rawEval) : {};
      // merge with current child levels to pre-color as edit
      const rawLv = localStorage.getItem(`planner.child.${childId}.levels`);
      const levels: Record<string, number> = rawLv ? JSON.parse(rawLv) : {};
      const fromLevels: Record<string, EvalState> = {};
      Object.entries(levels).forEach(([id, lvl]) => {
        if (lvl >= 2) fromLevels[id] = 2; else if (lvl > 0) fromLevels[id] = 1; else fromLevels[id] = 0;
      });
      // levels take precedence (reflect current genome), then fill with saved eval
      const merged: Record<string, EvalState> = { ...savedEval, ...fromLevels };
      setEvalMap(merged);
    } catch {}
  }, [childId]);
  React.useEffect(()=>{
    if (!childId) return;
    try { localStorage.setItem(`planner.eval.${childId}`, JSON.stringify(evalMap)); } catch {}
  }, [childId, evalMap]);

  // Update achievements overlay when a node is marked Achieved
  const markAchievedOverlay = (nodeId: string)=>{
    if (!childId) return;
    try{
      const raw = localStorage.getItem('planner.achieved.v1');
      const byChild = raw ? JSON.parse(raw) : {};
      const list: {nodeId:string; at?:string}[] = Array.isArray(byChild[childId]) ? byChild[childId] : [];
      const have = new Set(list.map(x=>x.nodeId));
      const chain = expandWithParents(nodeId, parentMap);
      const now = new Date().toISOString();
      chain.forEach(id => { if (!have.has(id)) list.push({ nodeId:id, at: now }); });
      byChild[childId] = list;
      localStorage.setItem('planner.achieved.v1', JSON.stringify(byChild));
      // also update per-child levels for visualizer
      const levels: Record<string, number> = {};
      list.forEach(x => { levels[x.nodeId] = 3; });
      localStorage.setItem(`planner.child.${childId}.levels`, JSON.stringify(levels));
    }catch{}
  };

  const cycleState = (nodeId: string)=>{
    setEvalMap(prev => {
      const cur = prev[nodeId] ?? 0;
      const next = ((cur + 1) % 3) as EvalState;
      const map = { ...prev, [nodeId]: next };
      if (next === 2) {
        const chain = expandWithParents(nodeId, parentMap);
        chain.forEach(id => { map[id] = 2; });
        markAchievedOverlay(nodeId);
      }
      return map;
    });
  };

  const saveAll = ()=>{
    if (!childId) return;
    // collect all achieved nodes and persist overlay + levels
    const achievedIds = Object.keys(evalMap).filter(id => (evalMap[id] ?? 0) === 2);
    try{
      const raw = localStorage.getItem('planner.achieved.v1');
      const byChild = raw ? JSON.parse(raw) : {};
      const list: {nodeId:string; at?:string}[] = Array.isArray(byChild[childId]) ? byChild[childId] : [];
      const have = new Set(list.map(x=>x.nodeId));
      const now = new Date().toISOString();
      achievedIds.forEach(id => expandWithParents(id, parentMap).forEach(nid => { if (!have.has(nid)) list.push({ nodeId:nid, at: now }); }));
      byChild[childId] = list;
      localStorage.setItem('planner.achieved.v1', JSON.stringify(byChild));
      const levels: Record<string, number> = {};
      list.forEach(x => { levels[x.nodeId] = 3; });
      localStorage.setItem(`planner.child.${childId}.levels`, JSON.stringify(levels));
      if (typeof onSaved === 'function') onSaved();
      alert('Evaluation saved');
    }catch{}
  };

  if (!open) return null;
  if (!childId) return null;

  // Build mapping: for each tag+bucket, list nodes
  const cellNodes: Record<string, Node[]> = React.useMemo(()=>{
    const m: Record<string, Node[]> = {};
    for (const n of nodes){
      const st = n.ageBand?.typicalStart ?? 0;
      const bIdx = Math.min(Math.floor(st/3), buckets.length-1);
      const keyPart = bIdx.toString();
      (n.tags||[]).forEach(t => {
        const key = `${t}::${keyPart}`;
        (m[key] ||= []).push(n);
      });
    }
    return m;
  }, [nodes, buckets.length]);

  const filteredTags = tags.filter(t => t.toLowerCase().includes(search.trim().toLowerCase()));

  // Try load readable names for known tags (using domains metadata as partial source)
  React.useEffect(()=>{
    (async()=>{
      try{
        const resp = await fetch('/data/domains.json');
        if (resp.ok){
          const j = await resp.json();
          const map: Record<string,string> = {};
          (j?.domains||[]).forEach((d:any)=>{ if(d?.id && d?.name) map[d.id]=d.name; });
          setTagNames(map);
          return;
        }
      }catch{}
      try{
        const resp = await fetch('/data/metadata/domains.json');
        if (resp.ok){
          const j = await resp.json();
          const map: Record<string,string> = {};
          (j?.domains||[]).forEach((d:any)=>{ if(d?.id && d?.name) map[d.id]=d.name; });
          setTagNames(map);
          return;
        }
      }catch{}
    })();
  }, []);

  const humanizeTag = (t:string)=>{
    if (tagNames[t]) return tagNames[t];
    return t.replace(/[_-]+/g,' ').replace(/\b\w/g, s=> s.toUpperCase());
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'stretch', justifyContent:'center', zIndex:1000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff', borderRadius:12, margin:12, padding:12, width:'min(1200px, 98vw)', height:'min(90vh, 98vh)', display:'flex', flexDirection:'column', border:'1px solid #e5e7eb'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <strong>Child Evaluation</strong>
            <input placeholder="Filter tags…" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8}} />
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={saveAll} className="btn" style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Save</button>
            <button onClick={onClose} style={{border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px'}}>Close</button>
          </div>
        </div>
        <div style={{overflow:'auto', border:'1px solid #e5e7eb', borderRadius:10}}>
          <div style={{display:'grid', gridTemplateColumns:`140px repeat(${buckets.length}, 300px)`}}>
            {/* Header row */}
            <div style={{background:'#f8fafc', borderBottom:'1px solid #e5e7eb', padding:8, position:'sticky', left:0, zIndex:1}}></div>
            {buckets.map((b, i)=>(
              <div key={i} style={{background:'#f8fafc', borderBottom:'1px solid #e5e7eb', padding:8, textAlign:'center', fontWeight:600}}>{b.label}</div>
            ))}
            {/* Rows per tag */}
            {filteredTags.map(tag => (
              <React.Fragment key={tag}>
                <div style={{borderRight:'1px solid #e5e7eb', padding:6, position:'sticky', left:0, background:'#fff', zIndex:1, fontWeight:600, fontSize:11, display:'flex', alignItems:'center', gap:6, minWidth:0}}>
                  {icons?.[tag] ? (<span style={{fontSize:16, flex:'0 0 auto'}}>{icons[tag]}</span>) : null}
                  <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={humanizeTag(tag)}>{humanizeTag(tag)}</span>
                </div>
                {buckets.map((b, bi)=>{
                  const key = `${tag}::${bi}`;
                  const arr = cellNodes[key] || [];
                  return (
                    <div key={key} style={{padding:12, minHeight:110, borderLeft:'1px solid #f3f4f6', borderBottom:'1px solid #f3f4f6'}}>
                      <div style={{display:'flex', flexWrap:'wrap', gap:12}}>
                        {arr.length===0 && (<span style={{color:'#9ca3af', fontSize:12}}>—</span>)}
                        {arr.map(n => {
                          const s = evalMap[n.id] ?? 0;
                          const bg = s===2 ? '#10b981' : s===1 ? '#f59e0b' : '#e5e7eb';
                          const fg = s===0 ? '#111' : '#fff';
                          const title = n.description || n.name;
                          return (
                            <button
                              key={n.id}
                              title={title}
                              onClick={()=> cycleState(n.id)}
                              style={{
                                border:'1px solid #d1d5db', background:bg, color:fg, borderRadius:10,
                                padding:'12px 14px', fontSize:13, cursor:'pointer', maxWidth:260,
                                textAlign:'left', whiteSpace:'normal', lineHeight:1.25, minWidth:220
                              }}>
                              {n.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Tip: Click a chip to cycle Not observed → Emerging → Achieved. Hover to see description.</div>
      </div>
    </div>
  );
}
