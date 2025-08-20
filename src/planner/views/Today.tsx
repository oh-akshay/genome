import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { expandWithParents } from '../services';
import { BaselineModal } from '../components/BaselineModal';
import { ChildChip } from '../components/ChildChip';

export function Today(){
  const { children, schedule, getChildAchievements, activities, genome } = usePlanner() as any;
  const [showBaseline, setShowBaseline] = React.useState(false);
  const [openRow, setOpenRow] = React.useState<string|null>(null);
  const [selectedChild, setSelectedChild] = React.useState<string>('');
  React.useEffect(()=>{ if(!selectedChild && children.length>0) setSelectedChild(children[0].childId); }, [children, selectedChild]);

  function masteryToLevel(status: 'emerging'|'secured'|'stretch', p: number|undefined){
    if (p != null){
      if (p >= 0.85) return 3;
      if (p >= 0.6) return 2;
      if (p >= 0.3) return 1;
      return 0;
    }
    if (status === 'secured') return 3;
    if (status === 'emerging') return 1;
    return 0; // stretch as future target by default
  }

  function monthsSince(dateISO: string): number {
    const d = new Date(dateISO);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
    return Math.max(0, Math.round(months));
  }

  function openGenomeForChild(c: any){
    try{
      // Build levels map for the visualizer from achievements
      const ach = getChildAchievements(c.childId) || [];
      const ids = expandWithParents(ach.map(a => a.nodeId));
      const levels: Record<string, number> = {};
      ids.forEach(id => { levels[id] = 3; });
      localStorage.setItem(`planner.child.${c.childId}.levels`, JSON.stringify(levels));
      if (c.dob) localStorage.setItem(`planner.child.${c.childId}.ageMonths`, String(monthsSince(c.dob)));
      // Open main genome visualizer with child query param
      window.open(`/?child=${encodeURIComponent(c.childId)}`, '_blank');
    }catch(e){
      alert('Failed to open genome view for child.');
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }
  return (
    <div style={{padding:16}}>
      <section style={{border:'1px solid #eee', borderRadius:12, padding:12, marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between'}}>
          <h3 style={{margin:0}}>Planned Targets Today</h3>
          <label>Child:&nbsp;
            <select value={selectedChild} onChange={e=>setSelectedChild(e.target.value)}>
              {children.map((c:any)=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
            </select>
          </label>
        </div>
        <PlannedTargetsList childId={selectedChild} schedule={schedule} activities={activities} genome={genome} />
      </section>
      <section style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {children.map(c=>(<ChildChip key={c.childId} c={c} onToggle={()=>openGenomeForChild(c)}/>))}
        <button onClick={()=>setShowBaseline(true)} style={{border:'1px solid #ddd',borderRadius:8,padding:'6px 10px'}}>Baseline…</button>
      </section>
      <section>
        {schedule.map(bl=>{
          const actById: Record<string, any> = Object.fromEntries((activities||[]).map((a:any)=>[a.activityId, a]));
          return (
            <div key={bl.blockId} style={{border:'1px solid #eee',borderRadius:12,padding:12, marginBottom:12}}>
              <h3 style={{marginTop:0}}>{bl.title}</h3>
              {bl.assigned.length===0 ? <div style={{color:'#999'}}>No activities assigned</div> :
                bl.assigned.map((asn,idx)=>{
                  const a = actById[asn.activityId];
                  const title = a?.title || asn.activityId;
                  const key = `${bl.blockId}:${idx}`;
                  const open = openRow === key;
                  const allTargets: string[] = Array.from(new Set(((a?.levels||[]).flatMap((l:any)=> l.targets || []))));
                  const materials = (a?.requirements?.materials || []) as string[];
                  return (
                    <div key={idx} style={{padding:'6px 8px', background:'#fafafa', borderRadius:8, marginBottom:8}}>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                        <div>
                          <strong>{title}</strong>
                          <div style={{fontSize:12,color:'#555'}}>Children: {asn.childIds.join(', ') || '—'}</div>
                        </div>
                        <button onClick={()=> setOpenRow(prev => prev===key? null : key)} style={{border:'1px solid #ddd', background:'#fff', borderRadius:8, padding:'2px 8px', cursor:'pointer'}} aria-expanded={open} aria-label="Toggle details">{open? '▾' : '▸'}</button>
                      </div>
                      {open && (
                        <div style={{marginTop:6, fontSize:12, color:'#333'}}>
                          {a?.requirements && (
                            <div style={{marginBottom:6}}>
                              <div><strong>Space:</strong> {a.requirements.space} · <strong>Duration:</strong> {a.requirements.duration} min · <strong>Noise:</strong> {a.requirements.noise}</div>
                              <div><strong>Materials:</strong> {materials.join(', ') || '—'}</div>
                            </div>
                          )}
                          <div>
                            <div style={{fontWeight:600, marginBottom:4}}>Targets</div>
                            {allTargets.length===0 ? <div style={{color:'#777'}}>—</div> : (
                              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                                {allTargets.map(t => (<span key={t} className="badge">{t}</span>))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          );
        })}
      </section>
      <BaselineModal open={showBaseline} onClose={()=>setShowBaseline(false)} />
    </div>
  )
}

// Modal rendered via portal-like simple overlay
export default Today;

function PlannedTargetsList({ childId, schedule, activities, genome }:{ childId:string; schedule:any[]; activities:any[]; genome:any[] }){
  if (!childId) return <div style={{color:'#999', fontSize:12, marginTop:6}}>Pick a child to view targets.</div>;
  const actById: Record<string, any> = Object.fromEntries((activities||[]).map((a:any)=>[a.activityId, a]));
  const nodeById: Record<string, any> = Object.fromEntries((genome||[]).map((n:any)=>[n.id, n]));
  const items: { activityId:string; title:string; level:string; nodeId:string; nodeName:string }[] = [];
  for (const bl of (schedule||[])){
    for (const asn of (bl.assigned||[])){
      if (!asn.childIds?.includes(childId)) continue;
      const a = actById[asn.activityId]; if (!a) continue;
      const lvl = (a.levels||[]).find((l:any)=>l.level===asn.level) || (a.levels||[])[1] || (a.levels||[])[0];
      const tgs: string[] = (lvl?.targets||[]);
      for (const tid of tgs){
        const n = nodeById[tid];
        items.push({ activityId:a.activityId, title:a.title, level:lvl?.level||asn.level||'core', nodeId:tid, nodeName:n?.name||tid });
      }
    }
  }
  if (items.length===0) return <div style={{color:'#999', fontSize:12, marginTop:6}}>No targets planned for this child today.</div>;
  return (
    <div style={{display:'grid', gap:8, marginTop:8}}>
      {items.map((it, idx)=>(
        <div key={`${it.activityId}-${it.nodeId}-${idx}`} style={{display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid #f0f0f0', borderRadius:8, padding:'6px 8px'}}>
          <div style={{display:'grid'}}>
            <div style={{fontWeight:600}}>{it.nodeName}</div>
            <div style={{fontSize:12, color:'#555'}}>{it.title} · {it.level}</div>
          </div>
          <a href={`/?child=${encodeURIComponent(childId)}&focus=${encodeURIComponent(it.nodeId)}`} target="_blank" rel="noreferrer" style={{fontSize:12}}>Open in genome ↗</a>
        </div>
      ))}
    </div>
  );
}
