import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { ActivityCard } from '../components/ActivityCard';
import { ChildChip } from '../components/ChildChip';
import { recommendForChild } from '../services/recommender';

export function Plan(){
  const { activities, schedule, setSchedule, children, getChildAchievements } = usePlanner();
  const [selectedChildren, setSelectedChildren] = React.useState<string[]>([]);
  const [recommendOn, setRecommendOn] = React.useState<boolean>(false);
  const [focusChild, setFocusChild] = React.useState<string>('');

  const toggleChild = (id:string)=> setSelectedChildren(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const addToCenters = (activityId:string)=>{
    const next = schedule.map(b=> b.blockId==='centers'
      ? ({...b, assigned:[...b.assigned, {activityId, childIds:selectedChildren, level:'core'}]})
      : b);
    setSchedule(next);
  };

  const shown = React.useMemo(()=>{
    if (recommendOn && focusChild){
      const ach = getChildAchievements(focusChild);
      return recommendForChild(activities, ach);
    }
    return activities;
  }, [activities, recommendOn, focusChild, getChildAchievements]);

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:16}}>
      <div style={{border:'1px solid #eee',borderRadius:12}}>
        <h3 style={{padding:'10px 12px',margin:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Activities</span>
          <span style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{fontSize:12}}>
              Focus child:&nbsp;
              <select value={focusChild} onChange={e=>setFocusChild(e.target.value)}>
                <option value="">(none)</option>
                {children.map(c=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
              </select>
            </label>
            <label style={{fontSize:12}}>
              <input type="checkbox" checked={recommendOn} onChange={e=>setRecommendOn(e.target.checked)} /> Recommend
            </label>
          </span>
        </h3>
        <div style={{padding:12}}>
          <div style={{margin:'8px 0',display:'flex',gap:8,flexWrap:'wrap'}}>
            {children.map(c=>(<ChildChip key={c.childId} c={c} selected={selectedChildren.includes(c.childId)} onToggle={toggleChild}/>))}
          </div>
          <div style={{display:'grid', gap:8}}>
            {shown.map(a=>(
              <div key={a.activityId} style={{border:'1px solid #eee',borderRadius:10,padding:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <strong>{a.title}</strong>
                  <button onClick={()=>addToCenters(a.activityId)}>Add to Centers</button>
                </div>
                <div style={{fontSize:12,color:'#555',marginTop:6}}>Targets: {a.levels.flatMap(l=>l.targets).join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{border:'1px solid #eee',borderRadius:12}}>
        <h3 style={{padding:'10px 12px',margin:0}}>Schedule & Assignment</h3>
        <div style={{padding:'0 12px 12px'}}>
          {schedule.map(bl=>(
            <div key={bl.blockId} style={{border:'1px dashed #ddd',borderRadius:10,padding:10, marginBottom:10}}>
              <strong>{bl.title}</strong>
              {bl.assigned.map((a,idx)=>(
                <div key={idx} style={{marginTop:6, background:'#fafafa',padding:8,borderRadius:8}}>
                  {a.activityId}
                  <div style={{display:'flex',gap:8,marginTop:6,alignItems:'center'}}>
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
