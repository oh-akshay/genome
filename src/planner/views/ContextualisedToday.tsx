import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { type GenomeIndex } from '../services/genomeEngine';
import { contextualiseActivity, type AISuggestionGroup } from '../services/ai';

type CtxSuggestion = {
  childId: string;
  childName: string;
  readiness: 'ready'|'stretch'|'scaffold';
  focusTargets: { id:string; name:string }[];
  notes: string[];
};

export default function ContextualisedToday(){
  const ctx = usePlanner() as any;
  const children = (ctx?.children || []) as any[];
  const activities = (ctx?.activities || []) as any[];
  const genome = (ctx?.genome || []) as any[];
  const timetable = ctx?.timetable as any;
  const weeklyPlan = (ctx?.weeklyPlan || {}) as Record<string, any[]>;
  const selectedDay = (ctx?.selectedDay || 'Mon') as string;
  const selectedAgeGroupId = ctx?.selectedAgeGroupId as string;
  const setSelectedAgeGroupId = (ctx?.setSelectedAgeGroupId || (()=>{})) as (id:string)=>void;
  const getChildAchievements = (ctx?.getChildAchievements || (()=>[])) as (id:string)=>{nodeId:string}[];

  const nodeById: Record<string, any> = Object.fromEntries((genome||[]).map((n:any)=>[n.id, n]));
  const actById: Record<string, any> = Object.fromEntries((activities||[]).map((a:any)=>[(a.activityId||a.id), a]));

  const age = (timetable?.ageGroups || []).find((a:any)=>a.id===selectedAgeGroupId) || (timetable?.ageGroups || [])[0];
  const slots = (age?.slots || []) as any[];
  const todayItems = (weeklyPlan?.[selectedDay] || []) as { time:string; slotType:string; activityId:string }[];

  const idxRef = React.useRef<GenomeIndex|null>(null);
  React.useEffect(()=>{ try{ idxRef.current = getGenomeIndex(); }catch{ idxRef.current = null; } }, []);

  const [aiCache, setAiCache] = React.useState<Record<string, AISuggestionGroup[]>>({});
  const [aiLoading, setAiLoading] = React.useState<Record<string, boolean>>({});

  async function ensureAISuggestions(activityId:string, activity:any){
    if (aiCache[activityId] || aiLoading[activityId]) return;
    setAiLoading(prev => ({...prev, [activityId]: true}));
    try{
      const suggestions = await contextualiseActivity({ activity, children, nodeById, getChildAchievements });
      setAiCache(prev => ({...prev, [activityId]: suggestions}));
    }catch(e){
      // eslint-disable-next-line no-console
      console.warn('[ai] failed to contextualise', e);
    }finally{
      setAiLoading(prev => ({...prev, [activityId]: false}));
    }
  }

  return (
    <div style={{padding:16}}>
      <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', marginBottom:12}}>
        <h3 style={{margin:0}}>Contextualised Today</h3>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {timetable && (
            <label style={{fontSize:12}}>Age group:
              <select value={age?.id || ''} onChange={e=>setSelectedAgeGroupId(e.target.value)}>
                {(timetable?.ageGroups||[]).map((a:any)=>(<option key={a.id} value={a.id}>{a.label}</option>))}
              </select>
            </label>
          )}
          <label style={{fontSize:12}}>Day:
            <select value={selectedDay} onChange={e=>ctx.setSelectedDay(e.target.value)}>
              {(timetable?.days || ['Mon','Tue','Wed','Thu','Fri']).map((d:string)=>(<option key={d} value={d}>{d}</option>))}
            </select>
          </label>
        </div>
      </div>

      {!timetable || !age ? (
        <div style={{color:'#999'}}>Load timetable and weekly plan to contextualise activities.</div>
      ) : (
        <div style={{display:'grid', gap:12}}>
          {slots.map((s:any, idx:number)=>{
            const items = (todayItems||[]).filter(it => it.time===s.time && it.slotType===s.type);
            if (items.length===0) return (
              <div key={idx} style={{border:'1px solid #eef2f7', borderRadius:12, padding:12, background:'#fff'}}>
                <div style={{fontWeight:700}}>{s.time} · {s.type}</div>
                <div style={{color:'#9aa1aa', fontSize:12}}>No activity assigned</div>
              </div>
            );
            return items.map((it:any, i:number)=>{
              const a = actById[it.activityId] || {};
              const title = a?.title || it.activityId;
              const actKey = a?.activityId || it.activityId || `${idx}:${i}`;
              React.useEffect(()=>{ ensureAISuggestions(actKey, a); }, [actKey, selectedDay, selectedAgeGroupId, children.length]);
              // Only render non-empty groups. Some AI providers may return
              // placeholder groups for ready/stretch/scaffold even when no
              // children fall into a bucket. Filter those out here.
              const grouped = (aiCache[actKey] || []).filter(g =>
                (Array.isArray((g as any).childIds) && (g as any).childIds.length > 0) ||
                (Array.isArray((g as any).childNames) && (g as any).childNames.length > 0)
              );
              return (
                <div key={`${idx}:${i}`} style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      {a?.emoji && <span aria-hidden style={{fontSize:16}}>{a.emoji}</span>}
                      <div>
                        <div style={{fontWeight:700}}>{title}</div>
                        <div style={{fontSize:12, color:'#475569'}}>{s.time} · {s.type}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{marginTop:8, display:'grid', gap:8}}>
                    {grouped.map((g, gi) => (
                      <div key={gi} style={{border:'1px solid #f1f5f9', borderRadius:10, padding:10, background:'#fbfdff'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                          <div style={{fontWeight:700, display:'flex', flexWrap:'wrap', gap:6}}>
                            {(g.childNames||[]).map((nm, idx)=> (<span key={idx} style={{border:'1px solid #e5e7eb', borderRadius:999, padding:'2px 8px', fontSize:12, background:'#fff'}}>{nm}</span>))}
                          </div>
                          <span style={{fontSize:12, color:'#6b7280'}}>({g.readiness})</span>
                        </div>
                        {(g.focusTargets||[]).length>0 && (
                          <div style={{fontSize:12, color:'#334155', marginTop:6}}>Focus: {(g.focusTargets||[]).map(f=>f.name).join(', ')}</div>
                        )}
                        <ul style={{margin:'6px 0 0 18px', fontSize:12, color:'#333'}}>
                          {(g.notes||[]).map((n, j)=>(<li key={j}>{n}</li>))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })}
        </div>
      )}
    </div>
  );
}
