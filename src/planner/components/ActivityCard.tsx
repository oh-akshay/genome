import React from 'react';
import type { Activity } from '../services';

export function ActivityCard({a, onAdd}:{a:Activity; onAdd?:(id:string)=>void}){
  return (
    <div style={{border:'1px solid #eee',borderRadius:10,padding:10}}>
      <strong>{a.title}</strong>
      <div style={{fontSize:12,color:'#555',margin:'6px 0'}}>Targets: {a.levels.map(l=>l.targets.join('/')).join(' | ')}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {a.levels.map(l=>(<span key={l.level} style={{fontSize:11,border:'1px solid #ddd',borderRadius:8,padding:'2px 6px'}}>{l.level}</span>))}
      </div>
      <button onClick={()=>onAdd?.(a.activityId)} style={{marginTop:8,padding:'6px 10px'}}>Add to Centers</button>
    </div>
  )
}