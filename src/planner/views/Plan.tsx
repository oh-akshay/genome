import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { ActivityCard } from '../components/ActivityCard';
import { ChildChip } from '../components/ChildChip';

export function Plan(){
  const { activities, schedule, setSchedule, children } = usePlanner();
  const [selectedChildren, setSelectedChildren] = React.useState<string[]>([]);

  const toggleChild = (id:string)=> setSelectedChildren(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const addToCenters = (activityId:string)=>{
    const next = schedule.map(b=> b.blockId==='centers' ? ({...b, assigned:[...b.assigned, {activityId, childIds:selectedChildren, level:'core'}]}) : b);
    setSchedule(next);
  };

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,padding:16}}>
      <div style={{border:'1px solid #eee',borderRadius:12}}>
        <h3 style={{padding:'10px 12px',margin:0}}>Activities</h3>
        <div style={{padding:12, display:'grid', gap:8}}>
          {activities.map(a=>(<ActivityCard key={a.activityId} a={a} onAdd={addToCenters}/>))}
        </div>
      </div>
      <div style={{border:'1px solid #eee',borderRadius:12}}>
        <h3 style={{padding:'10px 12px',margin:0}}>Schedule & Assignment</h3>
        <div style={{padding:'0 12px 12px'}}>
          <div style={{margin:'8px 0',display:'flex',gap:8,flexWrap:'wrap'}}>
            {children.map(c=>(<ChildChip key={c.childId} c={c} selected={selectedChildren.includes(c.childId)} onToggle={toggleChild}/>))}
          </div>
          {schedule.map(bl=>(
            <div key={bl.blockId} style={{border:'1px dashed #ddd',borderRadius:10,padding:10, marginBottom:10}}>
              <strong>{bl.title}</strong>
              {bl.assigned.map((a,idx)=>(
                <div key={idx} style={{marginTop:6, background:'#fafafa',padding:8,borderRadius:8}}>
                  {a.activityId}
                  <div style={{display:'flex',gap:8,marginTop:6,alignItems:'center'}}>
                    <label>Level:&nbsp;
                      <select value={a.level} onChange={e=>{
                        const val = e.target.value as any;
                        const next = schedule.map(b=> b.blockId===bl.blockId ? ({...b, assigned: b.assigned.map((x,i)=> i===idx ? {...x, level:val} : x)}) : b);
                        setSchedule(next);
                      }}>
                        <option value="foundational">Foundational</option>
                        <option value="core">Core</option>
                        <option value="stretch">Stretch</option>
                      </select>
                    </label>
                    <button onClick={()=>{
                      const next = schedule.map(b=> b.blockId===bl.blockId ? ({...b, assigned: b.assigned.filter((_,i)=> i!==idx)}) : b);
                      setSchedule(next);
                    }}>Remove</button>
                  </div>
                  <div style={{fontSize:12,color:'#555',marginTop:6}}>Children: {a.childIds.join(', ') || '—'}</div>
                </div>
              ))}
              {bl.assigned.length===0 && <div style={{color:'#999',fontSize:12,marginTop:6}}>No activities yet</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}