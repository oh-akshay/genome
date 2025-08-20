import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { getGenomeIndex, expandWithParents } from '../services';

function monthsSince(dateISO: string): number {
  const d = new Date(dateISO);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0, Math.round(months));
}

export function BaselineModal({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { children, saveAchievement } = usePlanner();
  const [childId, setChildId] = React.useState<string>('');
  const [age, setAge] = React.useState<number>(12);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [showRelevantOnly, setShowRelevantOnly] = React.useState<boolean>(true);
  const [openBranch, setOpenBranch] = React.useState<Set<string>>(new Set());
  // Age-bucket stepper instead of domains
  const [bucketIdx, setBucketIdx] = React.useState<number>(0);
  const [buckets, setBuckets] = React.useState<Array<{ start:number; end:number; label:string }>>([]);

  React.useEffect(()=>{
    if (open) {
      const first = children[0];
      if (first){
        setChildId(first.childId);
        if ((first as any).dob) setAge(monthsSince((first as any).dob));
      }
      setSelected(new Set());
      setError(null);
    }
  }, [open, children]);

  // When child changes, auto-populate age from DOB if present
  React.useEffect(() => {
    const c = children.find((x:any)=> x.childId === childId) as any;
    if (c?.dob) setAge(monthsSince(c.dob));
  }, [childId, children]);

  let idx: any = null;
  try { idx = getGenomeIndex(); } catch { /* ignore */ }

  const byBranch: { rootId: string; name: string; items: { id: string; name: string; start?: number; end?: number; exit?: string[]; relevant: boolean }[] }[] = [];
  if (idx) {
    // Build age buckets (6-month ranges) from genome
    if (buckets.length === 0) {
      let maxEnd = 0;
      Object.values(idx.nodeById).forEach((n:any) => {
        const e = n?.ageBand?.typicalEnd; if (typeof e === 'number') maxEnd = Math.max(maxEnd, e);
      });
      const arr: Array<{start:number; end:number; label:string}> = [];
      for (let s = 0; s <= Math.max(maxEnd, 6); s += 6) {
        const e = s + 6;
        arr.push({ start: s, end: e, label: `${s}–${e}m` });
      }
      setBuckets(arr);
      setBucketIdx(0);
    }
    for (const r of idx.roots) {
      const items = Object.keys(idx.nodeById)
        .filter(id => idx.rootFor[id] === r)
        .sort((a,b)=> (idx.depth[a]||0) - (idx.depth[b]||0))
        .map(id => {
          const n = idx.nodeById[id];
          const ab = n?.ageBand || {};
          const relevant = (typeof ab?.typicalStart==='number' && typeof ab?.typicalEnd==='number') ? (age >= ab.typicalStart && age <= ab.typicalEnd) : false;
          return { id, name: n?.name || id, start: ab?.typicalStart, end: ab?.typicalEnd, exit: (n?.exitCriteria || []) as string[], relevant } as any;
        });
      const name = (idx.nodeById[r]?.name) || r;
      byBranch.push({ rootId: r, name, items });
    }
  }

  // no domain metadata needed anymore

  const toggle = (id:string)=> setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectUpToAge = ()=>{
    if (!idx) return;
    const up = new Set<string>();
    for (const id of Object.keys(idx.nodeById)){
      const n = idx.nodeById[id];
      const end = n?.ageBand?.typicalEnd;
      if (typeof end === 'number' && end <= age) up.add(id);
    }
    setSelected(up);
  };

  const selectBranchUpToAge = (rootId:string)=>{
    if (!idx) return;
    setSelected(prev => {
      const up = new Set(prev);
      for (const id of Object.keys(idx.nodeById)){
        if (idx.rootFor[id] !== rootId) continue;
        const end = idx.nodeById[id]?.ageBand?.typicalEnd;
        if (typeof end === 'number' && end <= age) up.add(id);
      }
      return up;
    });
  };

  const clearBranch = (rootId:string)=>{
    if (!idx) return;
    setSelected(prev => {
      const up = new Set(prev);
      for (const id of Object.keys(idx.nodeById)) if (idx.rootFor[id] === rootId) up.delete(id);
      return up;
    });
  };

  const apply = ()=>{
    try{
      if (!childId) { setError('Pick a child'); return; }
      const ids = expandWithParents(Array.from(selected));
      const now = new Date().toISOString();
      ids.forEach(id => saveAchievement(childId, { nodeId: id, at: now }));
      // also save visualizer per-child levels for immediate consistency
      const levels: Record<string, number> = {}; ids.forEach(id => levels[id] = 3);
      localStorage.setItem(`planner.child.${childId}.levels`, JSON.stringify(levels));
      const c = children.find(c=>c.childId===childId) as any;
      if (c?.dob) localStorage.setItem(`planner.child.${childId}.ageMonths`, String(monthsSince(c.dob)));
      onClose();
      alert('Baseline saved');
    }catch(e:any){ setError(e?.message || 'Failed to baseline'); }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff', borderRadius:12, padding:14, width:'min(900px, 96vw)', maxHeight:'80vh', overflow:'auto', border:'1px solid #eee'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <h3 style={{margin:0}}>Baseline Child Genome</h3>
          <button onClick={onClose}>Close</button>
        </div>
        {error && <div style={{color:'#b91c1c', fontSize:12, marginBottom:8}}>{error}</div>}
        <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:10}}>
          <label>Child:&nbsp;
            <select value={childId} onChange={e=>setChildId(e.target.value)}>
              {children.map(c=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
            </select>
          </label>
          <label>Age (months):&nbsp;
            <input type="number" min={0} max={96} value={age} onChange={e=>setAge(parseInt(e.target.value)||0)} style={{width:80}}/>
          </label>
          <button onClick={selectUpToAge}>Select all up to age</button>
          <label style={{marginLeft:'auto', fontSize:12}}>
            <input type="checkbox" checked={showRelevantOnly} onChange={e=>setShowRelevantOnly(e.target.checked)} /> Show only age-relevant
          </label>
        </div>
        {buckets.length>0 && (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'6px 0 10px'}}>
            <button disabled={bucketIdx<=0} onClick={()=> setBucketIdx(i=> Math.max(0, i-1))}>◀ Prev Age</button>
            <div style={{fontWeight:700}}>Age bucket: {buckets[bucketIdx]?.label || ''}</div>
            <button disabled={bucketIdx>=buckets.length-1} onClick={()=> setBucketIdx(i=> Math.min(buckets.length-1, i+1))}>Next Age ▶</button>
          </div>
        )}
        {!idx ? (
          <div style={{color:'#6b7280'}}>Genome not loaded yet.</div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:10}}>
            {byBranch.map(b => {
              const open = openBranch.has(b.rootId);
              const visible = b.items.filter((it:any) => {
                const st = typeof it.start==='number' ? it.start : 0;
                const en = typeof it.end==='number' ? it.end : st;
                const bucket = buckets[bucketIdx] || {start:0,end:0};
                const inBucket = st >= bucket.start && st < bucket.end;
                const relOk = !showRelevantOnly || it.relevant;
                return inBucket && relOk;
              });
              const selectedCount = b.items.filter(it => selected.has(it.id)).length;
              const relevantCount = visible.length;
              return (
                <div key={b.rootId} style={{border:'1px solid #eee', borderRadius:10, padding:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                    <div style={{fontWeight:600}}>{b.name} <span style={{fontSize:12, color:'#6b7280'}}>({selectedCount} selected{showRelevantOnly? ` / ${relevantCount} shown`: ''})</span></div>
                    <div style={{display:'flex', gap:6}}>
                      <button onClick={()=>selectBranchUpToAge(b.rootId)} title="Select all in this branch up to age">Select ≤ age</button>
                      <button onClick={()=>clearBranch(b.rootId)} title="Clear selections for this branch">Clear</button>
                      <button onClick={()=> setOpenBranch(prev => { const s=new Set(prev); s.has(b.rootId)? s.delete(b.rootId): s.add(b.rootId); return s; })} aria-expanded={open}>{open? '▾' : '▸'}</button>
                    </div>
                  </div>
                  {open && (
                    <div style={{display:'grid', gap:6}}>
                      {/* Ladder-style picker: choose latest achieved (auto-selects previous) */}
                      <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:6}}>
                        {visible.map(it => (
                          <button key={`ladder-${it.id}`} onClick={()=>{
                            // Selecting a ladder node: include it and all ancestors
                            const chain = expandWithParents([it.id]);
                            setSelected(prev => new Set([ ...Array.from(prev), ...chain ]));
                          }} style={{border:'1px solid #e5e7eb', borderRadius:999, padding:'4px 8px', background: selected.has(it.id)? '#111827':'#fff', color: selected.has(it.id)? '#fff':'#111'}}>
                            {it.name}
                          </button>
                        ))}
                      </div>
                      {visible.map(it => (
                        <div key={it.id} style={{border:'1px solid #f0f0f0', borderRadius:8, padding:8}}>
                          <label title={`${it.start??''}-${it.end??''}m`} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                            <input type="checkbox" checked={selected.has(it.id)} onChange={()=>toggle(it.id)} />
                            <div style={{display:'grid'}}>
                              <div style={{fontWeight:600}}>{it.name} {typeof it.start==='number' && typeof it.end==='number' && (<span style={{fontWeight:400, color:'#6b7280'}}>({it.start}–{it.end}m)</span>)}</div>
                              {it.exit && it.exit.length>0 && (
                                <ul style={{margin:'4px 0 0 18px', padding:0}}>
                                  {it.exit.slice(0,3).map((e,i)=>(<li key={i} style={{fontSize:12, color:'#374151'}}>{e}</li>))}
                                </ul>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                      {visible.length===0 && <div style={{color:'#6b7280', fontSize:12}}>No items for current filter.</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={apply} style={{background:'#111', color:'#fff', borderRadius:8, padding:'6px 10px'}}>Save Baseline</button>
        </div>
      </div>
    </div>
  );
}
