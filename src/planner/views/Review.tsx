import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import type { Evidence } from '../services';
import { ExportPanel } from '../components/ExportPanel';

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function Review(){
  // Pull from context (some keys could be undefined during first render)
  const ctx = usePlanner() as any;

  // Coerce everything we use into safe arrays
  const kids = asArray(ctx?.children);
  const acts = asArray(ctx?.activities);
  const schedule = asArray(ctx?.schedule);
  const genome = asArray(ctx?.genome);
  const evs  = asArray<Evidence>(ctx?.evidence);

  const addEvidence     = ctx?.addEvidence ?? (()=>{});
  const saveAchievement = ctx?.saveAchievement ?? (()=>{});
  const getChildAchievements = ctx?.getChildAchievements ?? (()=>[]);

  // Loading guard: don’t render main UI until we have both arrays populated
  const loading = (kids.length === 0) || (acts.length === 0);

  const [note, setNote] = React.useState('');
  const [childId, setChildId] = React.useState<string>('');
  const [activityId, setActivityId] = React.useState<string>('');
  const [selectedTargets, setSelectedTargets] = React.useState<string[]>([]);
  const [selectAll, setSelectAll] = React.useState<boolean>(false);

  // Set defaults once data arrives
  React.useEffect(() => {
    if (!childId && kids.length > 0) setChildId(kids[0].childId);
  }, [kids, childId]);

  // Compute today's planned activities for the selected child
  const plannedActivityIds = React.useMemo(() => {
    if (!childId) return new Set<string>();
    const set = new Set<string>();
    schedule.forEach((b:any) => asArray(b.assigned).forEach((a:any) => {
      if (asArray<string>(a.childIds).includes(childId)) set.add(a.activityId);
    }));
    return set;
  }, [schedule, childId]);

  const availableActs = React.useMemo(() => {
    return acts.filter((a:any) => plannedActivityIds.has(a.activityId));
  }, [acts, plannedActivityIds]);

  React.useEffect(() => {
    if (!activityId && availableActs.length > 0) setActivityId(availableActs[0].activityId);
    if (availableActs.length === 0) setActivityId('');
  }, [availableActs, activityId]);

  // Collect targets for selected activity (union of all levels for MVP)
  const act = React.useMemo(()=> availableActs.find((a:any)=>a.activityId===activityId), [availableActs, activityId]);
  const targets = React.useMemo(()=> Array.from(new Set(asArray<any>(act?.levels).flatMap((l:any)=> asArray<string>(l.targets)))), [act]);

  // When targets change, reset selected
  React.useEffect(()=>{
    setSelectedTargets(targets);
    setSelectAll(true);
  }, [targets.join(',')]);

  const submit = ()=>{
    if (!childId || !activityId) { alert('Pick child and activity first'); return; }
    const sel = selectAll ? targets : selectedTargets;
    const ev: Evidence = {
      evidenceId: 'ev_'+Math.random().toString(36).slice(2,8),
      childId,
      activityId,
      time: new Date().toISOString(),
      signals: (sel.length>0 ? sel : targets).map(t => ({ nodeId: t, observation: 'observed in session', confidence: 0.7 })),
      notes: note
    };
    addEvidence(ev);

    const now = new Date().toISOString();
    const toMark = selectAll ? targets : selectedTargets;
    if (toMark.length > 0) {
      toMark.forEach(t => saveAchievement(childId, { nodeId: t, at: now }));
      alert(`Saved draft and marked achieved: ${toMark.join(', ')}`);
    } else {
      alert('Draft saved locally. Select targets to mark achieved.');
    }

    setNote('');
    setSelectedTargets([]);
    setSelectAll(false);
  };

  if (loading){
    return (
      <div style={{padding:16}}>
        <h3>Evidence & Drafts</h3>
        <div style={{color:'#999'}}>Loading children and activities…</div>
      </div>
    );
  }

  return (
    <div style={{padding:16}}>
      <h3>Evidence & Drafts</h3>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <label>Child:
          <select value={childId} onChange={e=>setChildId(e.target.value)}>
            {kids.map((c:any)=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
          </select>
        </label>
        <label>Activity:
          <select value={activityId} onChange={e=>setActivityId(e.target.value)}>
            {availableActs.map((a:any)=>(<option key={a.activityId} value={a.activityId}>{a.title}</option>))}
          </select>
        </label>
        <label style={{flex:'1 1 300px'}}>Notes:
          <input style={{width:'100%'}} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g., balanced scoop with assist; matched 2 shapes"/>
        </label>
        <button onClick={submit}>Generate Draft → Update Genome</button>
      </div>

      {/* Targets detail & selection */}
      {activityId && (
        <div style={{marginTop:12, border:'1px solid #eee', borderRadius:10, padding:10}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong>Targets</strong>
            <label style={{fontSize:12}}>
              <input type="checkbox" checked={selectAll} onChange={e=>{ setSelectAll(e.target.checked); setSelectedTargets(e.target.checked?targets:[]) }} /> Select all
            </label>
          </div>
          {targets.length===0 && <div style={{color:'#999'}}>No targets found for this level.</div>}
          <div style={{display:'grid', gap:6, marginTop:8}}>
            {targets.map(tid => {
              const n = genome.find((x:any)=>x.id===tid) as any;
              const name = n?.name || tid;
              const exit = asArray<string>((n?.exitCriteria)||[]).join(' • ');
              const checked = selectAll || selectedTargets.includes(tid);
              return (
                <div key={tid} style={{display:'grid', gap:4, border:'1px solid #f0f0f0', borderRadius:8, padding:8}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                    <label style={{display:'flex', alignItems:'center', gap:8}}>
                      <input type="checkbox" checked={checked} onChange={(e)=>{
                        const on = e.target.checked;
                        setSelectedTargets(prev => on ? Array.from(new Set([...prev, tid])) : prev.filter(x=>x!==tid));
                        if (!on) setSelectAll(false);
                      }} />
                      <span style={{fontWeight:600}}>{name}</span>
                    </label>
                    {childId && (
                      <a href={`/?child=${encodeURIComponent(childId)}&focus=${encodeURIComponent(tid)}`} target="_blank" rel="noreferrer" style={{fontSize:12}}>Open in genome ↗</a>
                    )}
                  </div>
                  {exit && <div style={{fontSize:12, color:'#555'}}>{exit}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{marginTop:20}}><ExportPanel/></div>

      <div style={{marginTop:20}}>
        <h4>Saved (local) evidence</h4>
        {(evs?.length ?? 0) === 0 && <div style={{color:'#999'}}>No drafts yet.</div>}
        {evs.map((ev:any)=>(
          <div key={ev.evidenceId} style={{border:'1px solid #eee',borderRadius:8,padding:8, marginBottom:8}}>
            <div style={{fontSize:12, color:'#555'}}>{new Date(ev.time).toLocaleString()}</div>
            <div><strong>{ev.childId}</strong> · {ev.activityId}</div>
            <div style={{fontSize:12, color:'#555'}}>{asArray(ev.signals).map((s:any)=>s.nodeId).join(', ')}</div>
            {ev.notes && <div style={{fontSize:12}}>{ev.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
