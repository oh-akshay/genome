import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { ChildChip } from '../components/ChildChip';

export function Today(){
  const { children, schedule } = usePlanner();
  return (
    <div style={{padding:16}}>
      <section style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {children.map(c=>(<ChildChip key={c.childId} c={c}/>))}
      </section>
      <section>
        {schedule.map(bl=>(
          <div key={bl.blockId} style={{border:'1px solid #eee',borderRadius:12,padding:12, marginBottom:12}}>
            <h3 style={{marginTop:0}}>{bl.title}</h3>
            {bl.assigned.length===0 ? <div style={{color:'#999'}}>No activities assigned</div> :
              bl.assigned.map((asn,idx)=>(
                <div key={idx} style={{padding:'6px 8px', background:'#fafafa', borderRadius:8, marginBottom:8}}>
                  <div><strong>{asn.activityId}</strong> · <em>{asn.level}</em></div>
                  <div style={{fontSize:12,color:'#555'}}>Children: {asn.childIds.join(', ') || '—'}</div>
                </div>
              ))
            }
          </div>
        ))}
      </section>
    </div>
  )
}