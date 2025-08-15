import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import type { Evidence } from '../services';
import { ExportPanel } from '../components/ExportPanel';

export function Review(){
  const { addEvidence, children, activities, evidence } = usePlanner();

  // Guard: if data still loading, show a friendly placeholder
  const loading = !children || children.length === 0 || !activities || activities.length === 0;

  const [note, setNote] = React.useState('');
  const [childId, setChildId] = React.useState<string>('');
  const [activityId, setActivityId] = React.useState<string>('');

  // When data arrives, set sane defaults exactly once
  React.useEffect(() => {
    if (!childId && children && children.length > 0) setChildId(children[0].childId);
  }, [children, childId]);

  React.useEffect(() => {
    if (!activityId && activities && activities.length > 0) setActivityId(activities[0].activityId);
  }, [activities, activityId]);

  const submit = ()=>{
    if (!childId || !activityId) {
      alert('Pick child and activity first');
      return;
    }
    const ev: Evidence = {
      evidenceId: 'ev_'+Math.random().toString(36).slice(2,8),
      childId,
      activityId,
      time: new Date().toISOString(),
      // NOTE: stub signal; replace with selected activity's targets if desired
      signals: [{ nodeId:'NUM-1TO1-5', observation:'counted to 4 with prompts', confidence:0.72 }],
      notes: note
    };
    addEvidence(ev);
    setNote('');
    alert('Draft saved locally. Use Export to download JSON for your OH Passport ingestor.');
  };

  if (loading) {
    return (
      <div style={{padding:16}}>
        <h3>Evidence & Drafts</h3>
        <div style={{color:'#999'}}>Loading children and activities…</div>
      </div>
    );
  }

  // Defensive: ensure arrays are defined
  const safeChildren = children ?? [];
  const safeActivities = activities ?? [];
  const safeEvidence = evidence ?? [];

  return (
    <div style={{padding:16}}>
      <h3>Evidence & Drafts</h3>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <label>Child:
          <select value={childId} onChange={e=>setChildId(e.target.value)}>
            {safeChildren.map(c=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
          </select>
        </label>
        <label>Activity:
          <select value={activityId} onChange={e=>setActivityId(e.target.value)}>
            {safeActivities.map(a=>(<option key={a.activityId} value={a.activityId}>{a.title}</option>))}
          </select>
        </label>
        <label style={{flex:'1 1 300px'}}>Notes:
          <input style={{width:'100%'}} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g., counted to 4 with 1:1, needed model first"/>
        </label>
        <button onClick={submit}>Generate Draft → Update Genome</button>
      </div>

      <div style={{marginTop:20}}>
        <ExportPanel/>
      </div>

      <div style={{marginTop:20}}>
        <h4>Saved (local) evidence</h4>
        {safeEvidence.length === 0 && <div style={{color:'#999'}}>No drafts yet.</div>}
        {safeEvidence.map(ev=>(
          <div key={ev.evidenceId} style={{border:'1px solid #eee',borderRadius:8,padding:8, marginBottom:8}}>
            <div style={{fontSize:12, color:'#555'}}>{new Date(ev.time).toLocaleString()}</div>
            <div><strong>{ev.childId}</strong> · {ev.activityId}</div>
            <div style={{fontSize:12, color:'#555'}}>{(ev.signals||[]).map(s=>s.nodeId).join(', ')}</div>
            {ev.notes && <div style={{fontSize:12}}>{ev.notes}</div>}
          </div>
        ))}
      </div>

      <div style={{marginTop:16, fontSize:12, color:'#666'}}>
        * In the full build, this would call your ASR/CV services and create OH Passport drafts for one-tap approval.
      </div>
    </div>
  );
}