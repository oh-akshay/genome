import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { ChildChip } from '../components/ChildChip';

export function Plan(){
  const { activities, children, timetable, weeklyPlan, selectedDay, setSelectedDay, selectedAgeGroupId, setSelectedAgeGroupId, addWeeklyItem, removeWeeklyItem } = usePlanner() as any;
  const [selectedChildren, setSelectedChildren] = React.useState<string[]>([]);
  const [openRow, setOpenRow] = React.useState<string|null>(null);

  const toggleChild = (id:string)=> setSelectedChildren(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  // derive slots for the selected age group
  const age = (timetable?.ageGroups || []).find((a:any)=>a.id===selectedAgeGroupId) || (timetable?.ageGroups || [])[0];
  const slots = age?.slots || [];

  const assignToSlot = (activityId:string, slotKey:string)=>{
    const [time, type] = slotKey.split('|');
    addWeeklyItem(selectedDay, { time, slotType:type, activityId, childIds: selectedChildren });
  };

  // Auto-assign Activity A/B/C based on activity tags, leave others unassigned
  const autoAssignABC = () => {
    if (!age) return;
    const slotTags: Record<string, string[]> = {
      'Activity A': ['language','early_numeracy','communication','cognitive'],
      'Activity B': ['fine_motor','visual_spatial','shape','color','art','music','movement'],
      'Activity C': ['sensory','practical_life','social','social_imitation','self_regulation'],
    };
    const dayItems = (weeklyPlan?.[selectedDay] || []) as any[];
    const used = new Set(dayItems.map(it => it.activityId));
    const slotsABC = (slots || []).filter((s:any)=> ['Activity A','Activity B','Activity C'].includes(s.type));
    const byType: Record<string, any[]> = {};
    for (const s of slotsABC) (byType[s.type] ||= []).push(s);

    const findMatch = (tagsWanted:string[]) => (activities as any[]).find((a:any) => {
      const id = a.activityId || a.id;
      if (!id || used.has(id)) return false;
      const tags = (a?.tags || []).map((t:string)=>String(t).toLowerCase());
      return tagsWanted.some(t => tags.includes(t));
    });

    for (const type of ['Activity A','Activity B','Activity C']){
      const slotsForType = byType[type] || [];
      if (slotsForType.length === 0) continue;
      // skip if already assigned for this day and type
      const already = dayItems.some(it => it.slotType === type);
      if (already) continue;
      const match = findMatch(slotTags[type] || []);
      if (!match) continue;
      const id = match.activityId || match.id;
      if (!id) continue;
      used.add(id);
      const s0 = slotsForType[0];
      addWeeklyItem(selectedDay, { time: s0.time, slotType: s0.type, activityId: id });
    }
  };

  // Auto-assign Activity A/B/C for the entire week (Mon–Fri or timetable.days)
  const autoAssignWeekABC = () => {
    if (!age) return;
    const days: string[] = Array.isArray(timetable?.days) && (timetable.days as any[]).length>0
      ? (timetable.days as string[])
      : ['Mon','Tue','Wed','Thu','Fri'];

    const slotTags: Record<string, string[]> = {
      'Activity A': ['language','early_numeracy','communication','cognitive'],
      'Activity B': ['fine_motor','visual_spatial','shape','color','art','music','movement'],
      'Activity C': ['sensory','practical_life','social','social_imitation','self_regulation'],
    };

    const slotsABC = (slots || []).filter((s:any)=> ['Activity A','Activity B','Activity C'].includes(s.type));
    const byType: Record<string, any[]> = {};
    for (const s of slotsABC) (byType[s.type] ||= []).push(s);

    const findMatch = (tagsWanted:string[], used:Set<string>) => (activities as any[]).find((a:any) => {
      const id = a.activityId || a.id;
      if (!id || used.has(id)) return false;
      const tags = (a?.tags || []).map((t:string)=>String(t).toLowerCase());
      return tagsWanted.some(t => tags.includes(t));
    });

    days.forEach((d) => {
      const dayItems = (weeklyPlan?.[d] || []) as any[];
      const used = new Set(dayItems.map(it => it.activityId));
      (['Activity A','Activity B','Activity C'] as const).forEach((type) => {
        const slotsForType = byType[type] || [];
        if (slotsForType.length === 0) return;
        const already = dayItems.some((it:any) => it.slotType === type);
        if (already) return;
        const match = findMatch(slotTags[type] || [], used);
        if (!match) return;
        const id = match.activityId || match.id;
        if (!id) return;
        used.add(id);
        const s0 = slotsForType[0];
        addWeeklyItem(d, { time: s0.time, slotType: s0.type, activityId: id });
      });
    });
  };

  const shown = activities;

  return (
    <div style={{display:'grid',gridTemplateColumns:'minmax(260px,30%) minmax(0, 1fr)',gap:16,padding:16, overflowX:'hidden'}}>
      <div style={{border:'1px solid #e5e7eb',borderRadius:12, background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
        <h3 style={{padding:'12px 14px',margin:0, display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f1f5f9'}}>
          <span>Activities</span>
          <span style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
            <label style={{fontSize:12}}>Day:
              <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}>
                {['Mon','Tue','Wed','Thu','Fri'].map(d=>(<option key={d} value={d}>{d}</option>))}
              </select>
            </label>
            {timetable && (
              <label style={{fontSize:12}}>Age group:
                <select value={age?.id || ''} onChange={e=>setSelectedAgeGroupId(e.target.value)}>
                  {(timetable?.ageGroups||[]).map((a:any)=>(<option key={a.id} value={a.id}>{a.label}</option>))}
                </select>
              </label>
            )}
            <button onClick={autoAssignABC} style={{border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer'}} title="Auto-assign A/B/C for selected day">Auto-assign A/B/C</button>
            <button onClick={autoAssignWeekABC} style={{border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer'}} title="Auto-assign A/B/C for the entire week">Auto-assign week</button>
          </span>
        </h3>
        <div style={{padding:12}}>
          <ActivitiesList activities={shown} onAssign={(activityId:string, slotKey:string)=>assignToSlot(activityId, slotKey)} slotOptions={slots.map((s:any)=>({ key:`${s.time}|${s.type}`, label:`${s.time} · ${s.type}` }))} />
        </div>
      </div>
      <div style={{border:'1px solid #e5e7eb',borderRadius:12, background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
        <h3 style={{padding:'12px 14px',margin:0, borderBottom:'1px solid #f1f5f9'}}>Weekly Planner — {selectedDay} · {age?.label || ''}</h3>
        <div style={{padding:'12px 14px'}}>
          {(!timetable || !age) && <div style={{color:'#999'}}>Load timetable to plan by slots.</div>}
          {timetable && age && (
            <div style={{display:'grid', gap:12}}>
              {slots.map((s:any, idx:number)=>{
                const items = (weeklyPlan?.[selectedDay]||[]).filter((it:any)=>it.time===s.time && it.slotType===s.type);
                const isABC = ['Activity A','Activity B','Activity C'].includes(s.type);
                return (
                  <div key={idx} style={{border:'1px solid #eef2f7',borderRadius:12,padding:12, background:isABC?'#fbfdff':'#fff'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                      <div>
                        <div style={{fontWeight:700}}>{s.time}</div>
                        <div style={{fontSize:12, color:'#475569'}}>{s.type}</div>
                      </div>
                      <div style={{fontSize:12, color:'#6b7280'}}>{s.desc}</div>
                    </div>
                    {items.length===0 && <div style={{color:'#9aa1aa', fontSize:12, marginTop:4}}>No activities assigned</div>}
                    {items.map((it:any, i:number)=>{
                      const a = (activities as any[]).find(x => (x.activityId||x.id) === it.activityId) || {};
                      const title = a?.title || it.activityId;
                      const tags = (a?.tags || []) as string[];
                      const materials = (a?.requirements?.materials || []) as string[];
                      const duration = a?.requirements?.duration;
                      const space = a?.requirements?.space;
                      const TAG_EMOJI: Record<string,string> = {
                        language:'🗣️', sensory:'✋', cognitive:'🧠', classification:'🗂️', sorting:'🧩', fine_motor:'✋', safety:'⚠️', color:'🎨', visual_discrimination:'👀', shape:'🔺', visual_spatial:'🧭', self_regulation:'🧘', communication:'💬', practical_life:'🧺', early_numeracy:'🔢', social:'🤝', social_imitation:'🪞', art:'🎨', music:'🎵', movement:'🏃'
                      };
                      return (
                        <div key={i} style={{marginTop:6, background:'#f8fafc',padding:10,borderRadius:10, border:'1px solid #e5e7eb', maxWidth:'100%'}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                            <div style={{fontWeight:600, overflowWrap:'anywhere', wordBreak:'break-word'}}>{title}</div>
                            <button onClick={()=>removeWeeklyItem(selectedDay, (weeklyPlan?.[selectedDay]||[]).indexOf(it))} style={{border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer'}}>Remove</button>
                          </div>
                          {(tags.length>0) && (
                            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:6}}>
                              {tags.map(t => (
                                <span key={t} style={{display:'inline-flex', alignItems:'center', gap:6, border:'1px solid #e5e7eb', background:'#fff', borderRadius:999, padding:'2px 8px', fontSize:12}}>
                                  <span aria-hidden>{TAG_EMOJI[t] || '🏷️'}</span>
                                  <span>{t.replace(/_/g,' ')}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {(duration || space || materials.length>0) && (
                            <div style={{fontSize:12, color:'#556070', marginTop:6, overflowWrap:'anywhere', wordBreak:'break-word'}}>
                              {duration ? `${duration} min` : ''}{duration && space ? ' · ' : ''}{space ? `space: ${space}` : ''}
                              {materials.length>0 && ` · materials: ${materials.slice(0,3).join(', ')}${materials.length>3 ? '…' : ''}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivitiesList({ activities, onAssign, slotOptions }:{ activities:any[]; onAssign:(activityId:string, slotKey:string)=>void; slotOptions:{key:string; label:string}[] }){
  return (
    <div style={{display:'grid', gap:8}}>
      {activities.map((a:any)=>{
        const title = a?.title || a?.activityId;
        const key = a.activityId;
        return (
          <div key={key} style={{border:'1px solid #e5e7eb',borderRadius:12,padding:10, background:'#fff', maxWidth:'100%'}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                {a?.emoji && <span aria-hidden style={{fontSize:16}}>{a.emoji}</span>}
                <strong style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>{title}</strong>
              </div>
              <div style={{flex:1}} />
              <select onChange={(e)=>{ const val=e.target.value; if (val) { onAssign(a.activityId, val); e.currentTarget.selectedIndex=0; } }} style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', maxWidth:'100%'}}>
                <option value="">Assign to slot…</option>
                {slotOptions.map(opt => (<option key={opt.key} value={opt.key}>{opt.label}</option>))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
