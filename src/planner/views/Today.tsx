import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { expandWithParents } from '../services';
import { BaselineModal } from '../components/BaselineModal';
import { ChildChip } from '../components/ChildChip';

/**
 * TODAY VIEW
 * - Top: Day selector (Mon–Fri)
 * - Section A: "Today's Weekly Plan" (from weeklyPlan[selectedDay])
 * - Section B: Legacy "Blocks" schedule from your build (if present) with full activity details
 * - Baseline modal trigger retained
 */

const DAYS: ('Mon'|'Tue'|'Wed'|'Thu'|'Fri')[] = ['Mon','Tue','Wed','Thu','Fri'];

export function Today(){
  const ctx = usePlanner() as any;
  const children = (ctx?.children || []) as any[];
  const activities = (ctx?.activities || []) as any[];
  const genome = (ctx?.genome || []) as any[];
  const weeklyPlan = (ctx?.weeklyPlan || {}) as Record<string, any[]>;
  const timetable = ctx?.timetable as any;
  const selectedAgeGroupId = ctx?.selectedAgeGroupId as string;
  const setSelectedAgeGroupId = (ctx?.setSelectedAgeGroupId || (()=>{})) as (id:string)=>void;
  const selectedDay = (ctx?.selectedDay || 'Mon') as (typeof DAYS)[number];
  const setSelectedDay = (ctx?.setSelectedDay || (()=>{})) as (d:(typeof DAYS)[number])=>void;

  // legacy schedule (your previous implementation)
  const schedule = (ctx?.schedule || []) as any[];

  const [showBaseline, setShowBaseline] = React.useState(false);
  const [openRow, setOpenRow] = React.useState<string|null>(null);
  const [selectedChild, setSelectedChild] = React.useState<string>('');
  React.useEffect(()=>{ if(!selectedChild && children.length>0) setSelectedChild(children[0].childId); }, [children, selectedChild]);

  function monthsSince(dateISO: string): number {
    const d = new Date(dateISO);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
    return Math.max(0, Math.round(months));
  }

  function openGenomeForChild(c: any){
    try{
      const getChildAchievements = (ctx?.getChildAchievements || (()=>[])) as (id:string)=>{nodeId:string}[];
      const ach = getChildAchievements(c.childId) || [];
      const ids = expandWithParents(ach.map(a => a.nodeId));
      const levels: Record<string, number> = {};
      ids.forEach(id => { levels[id] = 3; });
      localStorage.setItem(`planner.child.${c.childId}.levels`, JSON.stringify(levels));
      if (c.dob) localStorage.setItem(`planner.child.${c.childId}.ageMonths`, String(monthsSince(c.dob)));
      window.open(`/?child=${encodeURIComponent(c.childId)}`, '_blank');
    }catch(e){
      alert('Failed to open genome view for child.');
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  // maps for lookups
  const actById: Record<string, any> = Object.fromEntries((activities||[]).map((a:any)=>[(a.activityId||a.id), a]));
  const nodeById: Record<string, any> = Object.fromEntries((genome||[]).map((n:any)=>[n.id, n]));

  // weekly items for selected day
  const todayWeekly = (weeklyPlan?.[selectedDay] || []) as { time:string; slotType:string; activityId:string }[];
  const age = (timetable?.ageGroups || []).find((a:any)=>a.id===selectedAgeGroupId) || (timetable?.ageGroups || [])[0];
  const slots = (age?.slots || []) as any[];
  const derivedBlocks = React.useMemo(()=>{
    try{
      if (!timetable) return [] as any[];
      const age = (timetable?.ageGroups || []).find((a:any)=>a.id===selectedAgeGroupId) || (timetable?.ageGroups || [])[0];
      if (!age) return [] as any[];
      const slots = age.slots || [];
      const items = (weeklyPlan?.[selectedDay] || []) as any[];
      return slots.map((s:any, i:number)=>{
        const assigned = items.filter(it => it.time===s.time && it.slotType===s.type).map(it => ({ activityId: it.activityId, childIds: it.childIds || [], level:'core' }));
        return { blockId: `${s.time}|${s.type}|${i}`, title: `${s.time} · ${s.type}`, assigned };
      });
    }catch{ return [] as any[]; }
  }, [JSON.stringify(timetable), selectedAgeGroupId, selectedDay, JSON.stringify(weeklyPlan?.[selectedDay]||[])])

  return (
    <div style={{padding:16, maxWidth:'100%', overflowX:'hidden'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', marginBottom:12}}>
        <h3 style={{margin:0}}>Today</h3>
        <div style={{display:'flex', gap:6}}>
          {DAYS.map(d=>(
            <button
              key={d}
              onClick={()=>setSelectedDay(d)}
              style={{
                padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb',
                background: d===selectedDay? '#111827':'#fff',
                color: d===selectedDay? '#fff':'#111827', cursor:'pointer'
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline view */}
      <section style={{border:'1px solid #eee', borderRadius:12, padding:12, marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <h4 style={{margin:'0'}}>Today's Timeline</h4>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {timetable && (
              <label style={{fontSize:12}}>Age group:
                <select value={age?.id || ''} onChange={e=>setSelectedAgeGroupId(e.target.value)}>
                  {(timetable?.ageGroups||[]).map((a:any)=>(<option key={a.id} value={a.id}>{a.label}</option>))}
                </select>
              </label>
            )}
            <label>Child:&nbsp;
              <select value={selectedChild} onChange={e=>setSelectedChild(e.target.value)}>
                {children.map((c:any)=>(<option key={c.childId} value={c.childId}>{c.name}</option>))}
              </select>
            </label>
          </div>
        </div>

        {!timetable || !age ? (
          <div style={{color:'#999'}}>No timetable loaded. Use Plan to set up weekly plan.</div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'140px minmax(0,1fr)', gap:12}}>
            {slots.map((s:any, idx:number)=>{
              const items = (todayWeekly||[]).filter(it => it.time===s.time && it.slotType===s.type);
              const isABC = ['Activity A','Activity B','Activity C'].includes(s.type);
              return (
                <React.Fragment key={`${s.time}-${s.type}-${idx}`}>
                  {/* left time column */}
                  <div style={{position:'relative', paddingLeft:16}}>
                    <div style={{position:'absolute', left:6, top:2, bottom:2, width:2, background:'#e5e7eb'}}/>
                    <div style={{position:'relative'}}>
                      <div style={{width:10, height:10, borderRadius:'50%', background:'#94a3b8', position:'absolute', left:1, top:2}}/>
                      <div style={{fontWeight:700}}>{s.time}</div>
                      <div style={{fontSize:12, color:'#475569'}}>{s.type}</div>
                    </div>
                  </div>
                  {/* right activity column */}
                  <div style={{minWidth:0}}>
                    {items.length===0 ? (
                      <div style={{border:'1px dashed #e5e7eb', borderRadius:10, padding:10, color:'#94a3b8', background:'#fff'}}>No activity assigned</div>
                    ) : (
                      items.map((it:any, i:number)=>{
                        const a = actById[it.activityId] || {};
                        const title = a?.title || it.activityId;
                        const tags = (a?.tags || []) as string[];
                        const materials = (a?.requirements?.materials || []) as string[];
                        const duration = a?.requirements?.duration;
                        const space = a?.requirements?.space;
                        const TAG_EMOJI: Record<string,string> = {
                          language:'🗣️', sensory:'✋', cognitive:'🧠', classification:'🗂️', sorting:'🧩', fine_motor:'✋', safety:'⚠️', color:'🎨', visual_discrimination:'👀', shape:'🔺', visual_spatial:'🧭', self_regulation:'🧘', communication:'💬', practical_life:'🧺', early_numeracy:'🔢', social:'🤝', social_imitation:'🪞', art:'🎨', music:'🎵', movement:'🏃'
                        };
                        // outcome link to genome if available
                        const outcome = Array.isArray(a?.links) && a.links.length>0 ? a.links[0] : null;
                        const key = `tl:${idx}:${i}`;
                        const open = openRow === key;
                        const steps = (a?.steps || []) as {text:string}[];
                        const observe = (a?.observe || []) as string[];
                        const variations = (a?.variations || []) as string[];
                        const cautions = (a?.cautions || []) as string[];
                        const allTargets: string[] = Array.from(new Set(((a?.levels||[]).flatMap((l:any)=> l.targets || []))));
                        return (
                          <div key={i} style={{border:'1px solid #eef2f7', borderRadius:12, padding:12, background:isABC?'#fbfdff':'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.03)', maxWidth:'100%'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                              <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                                {a?.emoji && <span aria-hidden style={{fontSize:16}}>{a.emoji}</span>}
                                <div style={{fontWeight:700, overflowWrap:'anywhere', wordBreak:'break-word'}}>{title}</div>
                              </div>
                              <div style={{display:'flex', alignItems:'center', gap:8}}>
                                <button onClick={()=> setOpenRow(prev => prev===key? null : key)} style={{border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'4px 8px', cursor:'pointer'}} aria-expanded={open} aria-label="Toggle details">{open? '▾' : '▸'}</button>
                                {outcome?.nodeId && (
                                  <a href={`/?child=${encodeURIComponent(selectedChild)}&focus=${encodeURIComponent(outcome.nodeId)}`} target="_blank" rel="noreferrer" style={{fontSize:12}}>Open ↗</a>
                                )}
                              </div>
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
                            {open && (
                              <div style={{marginTop:8, fontSize:12, color:'#333', display:'grid', gap:10}}>
                                {a?.requirements && (
                                  <div>
                                    <div style={{fontWeight:600, marginBottom:4}}>Setup</div>
                                    <div><strong>Space:</strong> {space || '—'} · <strong>Duration:</strong> {duration || '—'} min · <strong>Noise:</strong> {a?.requirements?.noise || '—'}</div>
                                    <div><strong>Materials:</strong> {materials.join(', ') || '—'}</div>
                                  </div>
                                )}
                                {steps.length>0 && (
                                  <div>
                                    <div style={{fontWeight:600, marginBottom:4}}>Steps</div>
                                    <ol style={{margin:'4px 0 0 18px'}}>
                                      {steps.map((s, j)=>(<li key={j} style={{marginBottom:2}}>{s.text}</li>))}
                                    </ol>
                                  </div>
                                )}
                                {observe.length>0 && (
                                  <div>
                                    <div style={{fontWeight:600, marginBottom:4}}>Observe</div>
                                    <ul style={{margin:'4px 0 0 18px'}}>
                                      {observe.map((s, j)=>(<li key={j} style={{marginBottom:2}}>{s}</li>))}
                                    </ul>
                                  </div>
                                )}
                                {variations.length>0 && (
                                  <div>
                                    <div style={{fontWeight:600, marginBottom:4}}>Variations</div>
                                    <ul style={{margin:'4px 0 0 18px'}}>
                                      {variations.map((s, j)=>(<li key={j} style={{marginBottom:2}}>{s}</li>))}
                                    </ul>
                                  </div>
                                )}
                                {cautions.length>0 && (
                                  <div>
                                    <div style={{fontWeight:600, marginBottom:4}}>Cautions</div>
                                    <ul style={{margin:'4px 0 0 18px'}}>
                                      {cautions.map((s, j)=>(<li key={j} style={{marginBottom:2}}>{s}</li>))}
                                    </ul>
                                  </div>
                                )}
                                <div>
                                  <div style={{fontWeight:600, marginBottom:4}}>Targets</div>
                                  {allTargets.length===0 ? <div style={{color:'#777'}}>—</div> : (
                                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                                      {allTargets.map(tid => {
                                        const nn = nodeById[tid];
                                        const nm = nn?.name || tid;
                                        return (<span key={tid} className="badge">{nm}</span>);
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {children.map((c:any)=>(<ChildChip key={c.childId} c={c} onToggle={()=>openGenomeForChild(c)}/>))}
        <button onClick={()=>setShowBaseline(true)} style={{border:'1px solid #ddd',borderRadius:8,padding:'6px 10px'}}>Baseline…</button>
      </section>

      {/* Legacy detailed cards (fallback when no timetable) */}
      {(!timetable || !(age?.slots||[]).length) && (
      <section>
        {(Array.isArray(derivedBlocks) && derivedBlocks.length>0 ? derivedBlocks : schedule).map((bl:any)=>{
          const TAG_EMOJI: Record<string,string> = {
            language:'🗣️',
            sensory:'✋',
            cognitive:'🧠',
            classification:'🗂️',
            sorting:'🧩',
            fine_motor:'✋',
            safety:'⚠️',
            color:'🎨',
            visual_discrimination:'👀',
            shape:'🔺',
            visual_spatial:'🧭',
            self_regulation:'🧘',
            communication:'💬',
            practical_life:'🧺',
            early_numeracy:'🔢',
            social:'🤝',
            social_imitation:'🪞',
          };
          return (
            <div key={bl.blockId} style={{border:'1px solid #eee',borderRadius:12,padding:12, marginBottom:12}}>
              <h3 style={{marginTop:0}}>{bl.title}</h3>
              {(bl.assigned||[]).length===0 ? <div style={{color:'#999'}}>No activities assigned</div> :
                (bl.assigned||[]).map((asn:any,idx:number)=>{
                  const a = actById[asn.activityId];
                  const title = a?.title || asn.activityId;
                  const key = `${bl.blockId}:${idx}`;
                  const open = openRow === key;
                  const allTargets: string[] = Array.from(new Set(((a?.levels||[]).flatMap((l:any)=> l.targets || []))));
                  const materials = (a?.requirements?.materials || []) as string[];
                  const env = (a?.environment || []) as string[];
                  const tags = (a?.tags || []) as string[];
                  const steps = (a?.steps || []) as {text:string}[];
                  const observe = (a?.observe || []) as string[];
                  const variations = (a?.variations || []) as string[];
                  const cautions = (a?.cautions || []) as string[];
                  const outcomes = (a?.links || []) as {nodeId:string; meetsExit?:string}[];
                  return (
                    <div key={idx} style={{padding:'8px 10px', background:'#fafafa', borderRadius:8, marginBottom:8, border:'1px solid #f0f0f0'}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{display:'grid', gap:2, minWidth:0}}>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            {a?.emoji && <span aria-hidden style={{fontSize:16}}>{a.emoji}</span>}
                            <strong>{title}</strong>
                          </div>
                          <div style={{fontSize:12,color:'#555'}}>
                            Children: {(asn.childIds||[]).join(', ') || '—'}
                            {a?.requirements && (
                              <> · {a.requirements.duration} min · space: {a.requirements.space}</>
                            )}
                            {env.length>0 && <> · env: {env.join(', ')}</>}
                          </div>
                        </div>
                        <div style={{flex:1}} />
                        {(tags.length>0) && (
                          <div style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end'}}>
                            {tags.map(t => {
                              const emoji = TAG_EMOJI[t] || '🏷️';
                              return (
                                <span key={t} style={{display:'inline-flex', alignItems:'center', gap:6, border:'1px solid #ddd', background:'#fff', borderRadius:999, padding:'2px 8px', fontSize:12}}>
                                  <span aria-hidden>{emoji}</span>
                                  <span>{t.replace(/_/g,' ')}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <button onClick={()=> setOpenRow(prev => prev===key? null : key)} style={{border:'1px solid #ddd', background:'#fff', borderRadius:8, padding:'2px 8px', cursor:'pointer'}} aria-expanded={open} aria-label="Toggle details">{open? '▾' : '▸'}</button>
                      </div>

                      {open && (
                        <div style={{marginTop:8, fontSize:12, color:'#333', display:'grid', gap:10}}>
                          {a?.requirements && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Setup</div>
                              <div><strong>Space:</strong> {a.requirements.space} · <strong>Duration:</strong> {a.requirements.duration} min · <strong>Noise:</strong> {a.requirements.noise}</div>
                              <div><strong>Materials:</strong> {materials.join(', ') || '—'}</div>
                            </div>
                          )}
                          {steps.length>0 && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Steps</div>
                              <ol style={{margin:'4px 0 0 18px'}}>
                                {steps.map((s, i)=>(<li key={i} style={{marginBottom:2}}>{s.text}</li>))}
                              </ol>
                            </div>
                          )}
                          {observe.length>0 && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Observe</div>
                              <ul style={{margin:'4px 0 0 18px'}}>
                                {observe.map((s, i)=>(<li key={i} style={{marginBottom:2}}>{s}</li>))}
                              </ul>
                            </div>
                          )}
                          {variations.length>0 && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Variations</div>
                              <ul style={{margin:'4px 0 0 18px'}}>
                                {variations.map((s, i)=>(<li key={i} style={{marginBottom:2}}>{s}</li>))}
                              </ul>
                            </div>
                          )}
                          {cautions.length>0 && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Cautions</div>
                              <ul style={{margin:'4px 0 0 18px'}}>
                                {cautions.map((s, i)=>(<li key={i} style={{marginBottom:2}}>{s}</li>))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(outcomes) && outcomes.length>0 && (
                            <div>
                              <div style={{fontWeight:600, marginBottom:4}}>Outcomes</div>
                              <div style={{display:'grid', gap:4}}>
                                {outcomes.map((o, i)=>{
                                  const node = nodeById[o.nodeId];
                                  const name = node?.name || o.nodeId;
                                  return (
                                    <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, border:'1px solid #f0f0f0', borderRadius:6, padding:'6px 8px'}}>
                                      <div>
                                        <div style={{fontWeight:600}}>{name}</div>
                                        {o.meetsExit && <div style={{color:'#555'}}>{o.meetsExit}</div>}
                                      </div>
                                      <a href={`/?focus=${encodeURIComponent(o.nodeId)}`} target="_blank" rel="noreferrer" style={{fontSize:12}}>Open ↗</a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
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
      )}

      <BaselineModal open={showBaseline} onClose={()=>setShowBaseline(false)} />
    </div>
  )
}

export default Today;
