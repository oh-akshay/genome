import React from 'react';
import { usePlanner } from '../state/PlannerStore';
import { ChildChip } from '../components/ChildChip';

// NEW: AI planners + metadata loaders
import {
  loadMindMap,
  loadEnvironment,
  loadMaterials,
  loadTimetable,
} from '../services';
import { generateWeeklyPlan } from '../services/plannerAI';

/**
 * PLAN VIEW
 * - Section 1: Weekly Planner (NEW)
 *   Uses timetable.days + weeklyPlan/addWeeklyItem/removeWeeklyItem from the store.
 *   Includes "Generate Plan (Week)" button that fills the week using Planner AI.
 * - Section 2: Day Planner (LEGACY you built) – centers assignment workflow against `schedule`.
 */

export default function Plan() {
  const ctx = usePlanner() as any;

  // ---- DATA FROM STORE (defensive) ----
  const activities = (ctx?.activities || []) as any[];
  const children = (ctx?.children || []) as any[];
  // legacy day schedule (your build)
  const schedule = (ctx?.schedule || []) as any[];
  const setSchedule = (ctx?.setSchedule || (() => {})) as (x: any) => void;

  // weekly plan + helpers
  const timetable = (ctx?.timetable as any) || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], ageGroups: [] };
  const weeklyPlan = (ctx?.weeklyPlan || {}) as Record<string, any[]>;
  const addWeeklyItem = (ctx?.addWeeklyItem || ((d: string, _i: any) => {})) as (d: string, it: any) => void;
  const removeWeeklyItem = (ctx?.removeWeeklyItem || ((d: string, _i: number) => {})) as (d: string, i: number) => void;

  // ---- WEEKLY PLANNER CONTROLS ----
  const days = (timetable?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) as string[];
  const [slotType, setSlotType] = React.useState<string>('Activity A');
  const [time, setTime] = React.useState<string>('10:00–10:30');
  const [activityId, setActivityId] = React.useState<string>('');
  const [ageGroup, setAgeGroup] = React.useState<string>('toddlers');
  const [themeId, setThemeId] = React.useState<string>('food_we_eat');
  const [centreId, setCentreId] = React.useState<string>('centre_default');

  React.useEffect(() => {
    if (!activityId && activities.length > 0) {
      setActivityId(activities[0].activityId || activities[0].id || '');
    }
  }, [activities, activityId]);

  function addWeekly(day: string) {
    if (!activityId) return alert('Choose an activity');
    addWeeklyItem(day, { slotType, time, activityId });
  }

  async function onGenerateWeek() {
    try {
      const [mind, env, mats, tt] = await Promise.all([
        loadMindMap(themeId, ageGroup),
        loadEnvironment(centreId),
        loadMaterials(centreId),
        loadTimetable(),
      ]);

      // pick the ageGroup from timetable explicitly
      const chosenAge =
        tt.ageGroups.find((a: any) => a.id === ageGroup) || tt.ageGroups[0];
      if (!chosenAge) {
        alert('No timetable age group found. Check timetable.json.');
        return;
      }

      const ttForAge = { ...tt, ageGroups: [chosenAge] } as any;

      const weekly = generateWeeklyPlan(mind as any, ttForAge, activities as any, mats as any, env as any);

      // replace current weekly plan with generated one
      (timetable.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).forEach((d: string) => {
        // clear existing items for the day
        const count = (weeklyPlan[d] || []).length;
        for (let i = 0; i < count; i++) removeWeeklyItem(d as any, 0);
        // add generated
        (weekly[d as any] || []).forEach((pi: any) => addWeeklyItem(d as any, pi));
      });

      alert('Generated weekly plan from theme + constraints ✅');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Generate Plan] failed:', e);
      alert('Failed to generate weekly plan. Open console for details.');
    }
  }

  // ---- LEGACY DAY-PLANNER CONTROLS (your build kept intact) ----
  const [selectedChildren, setSelectedChildren] = React.useState<string[]>([]);
  const toggleChild = (id: string) =>
    setSelectedChildren((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const addToCenters = (actId: string) => {
    if (!Array.isArray(schedule) || schedule.length === 0) {
      alert('No daily schedule blocks present.');
      return;
    }
    const next = schedule.map((b: any) =>
      b.blockId === 'centers'
        ? {
            ...b,
            assigned: [...(b.assigned || []), { activityId: actId, childIds: selectedChildren, level: 'core' }],
          }
        : b
    );
    setSchedule(next);
  };

  const shown = activities;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 }}>
      {/* WEEKLY PLANNER (NEW) */}
      <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: 0 }}>Weekly Planner</h3>
          <button
            onClick={onGenerateWeek}
            style={{ border: '1px solid #ddd', background: '#111827', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            Generate Plan (Week)
          </button>
        </div>

        {/* Controls */}
        <div style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Age:&nbsp;
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              <option value="toddlers">Toddlers (12–24m)</option>
              <option value="prenursery">Pre-Nursery (2–3y)</option>
              <option value="nursery">Nursery (3–4y)</option>
            </select>
          </label>
          <label>Theme:&nbsp;
            <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="food_we_eat">The Food We Eat</option>
              {/* Add more themes here as you add mindmaps */}
            </select>
          </label>
          <label>Centre:&nbsp;
            <select value={centreId} onChange={(e) => setCentreId(e.target.value)}>
              <option value="centre_default">Default Centre</option>
              {/* Add more centres when you create per-centre env/material files */}
            </select>
          </label>
        </div>

        {/* Manual add row */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Slot:&nbsp;
            <input value={slotType} onChange={(e) => setSlotType(e.target.value)} />
          </label>
          <label>Time:&nbsp;
            <input value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>Activity:&nbsp;
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              {shown.map((a: any) => {
                const id = a.activityId || a.id;
                return (
                  <option key={id} value={id}>
                    {a.title || id}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {/* Week grid */}
        <div style={{ padding: '0 12px 12px', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={th}>Time / Slot</th>
                {days.map((d) => (
                  <th key={d} style={th}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStrong}>
                  {slotType}
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{time}</div>
                </td>
                {days.map((d) => (
                  <td key={d} style={td}>
                    <button onClick={() => addWeekly(d)} style={btn}>
                      + Add
                    </button>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      {(weeklyPlan?.[d] || [])
                        .filter((p: any) => p.slotType === slotType)
                        .map((p: any, idx: number) => {
                          const title =
                            activities.find((x: any) => (x.activityId || x.id) === p.activityId)?.title || p.activityId;
                          const removeIndex = (weeklyPlan?.[d] || []).indexOf(p);
                          return (
                            <div key={idx} style={pill}>
                              <div style={{ fontWeight: 600 }}>{title}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>{p.time}</div>
                              <button onClick={() => removeWeeklyItem(d, removeIndex)} style={smallBtn}>
                                Remove
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* DAY PLANNER (YOUR LEGACY FLOW) */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 12 }}>
          <h3 style={{ padding: '10px 12px', margin: 0 }}>Activities</h3>
          <div style={{ padding: 12 }}>
            <div style={{ margin: '8px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {children.map((c: any) => (
                <ChildChip
                  key={c.childId}
                  c={c}
                  selected={selectedChildren.includes(c.childId)}
                  onToggle={() => toggleChild(c.childId)}
                />
              ))}
            </div>
            <ActivitiesList activities={shown} onAdd={addToCenters} />
          </div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12 }}>
          <h3 style={{ padding: '10px 12px', margin: 0 }}>Schedule & Assignment</h3>
          <div style={{ padding: '0 12px 12px' }}>
            {Array.isArray(schedule) && schedule.length > 0 ? (
              schedule.map((bl: any) => (
                <div key={bl.blockId} style={{ border: '1px dashed #ddd', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <strong>{bl.title}</strong>
                  {(bl.assigned || []).map((a: any, idx: number) => (
                    <div key={idx} style={{ marginTop: 6, background: '#fafafa', padding: 8, borderRadius: 8 }}>
                      {a.activityId}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            const next = schedule.map((b: any) =>
                              b.blockId === bl.blockId
                                ? { ...b, assigned: (b.assigned || []).filter((_: any, i: number) => i !== idx) }
                                : b
                            );
                            setSchedule(next);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                        Children: {(a.childIds || []).join(', ') || '—'}
                      </div>
                    </div>
                  ))}
                  {(bl.assigned || []).length === 0 && (
                    <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>No activities yet</div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>No day schedule configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivitiesList({
  activities,
  onAdd,
}: {
  activities: any[];
  onAdd: (activityId: string) => void;
}) {
  const [openRow, setOpenRow] = React.useState<string | null>(null);
  const TAG_EMOJI: Record<string, string> = {
    language: '🗣️',
    sensory: '✋',
    cognitive: '🧠',
    classification: '🗂️',
    sorting: '🧩',
    fine_motor: '✋',
    safety: '⚠️',
    color: '🎨',
    visual_discrimination: '👀',
    shape: '🔺',
    visual_spatial: '🧭',
    self_regulation: '🧘',
    communication: '💬',
    practical_life: '🧺',
    early_numeracy: '🔢',
    social: '🤝',
    social_imitation: '🪞',
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {activities.map((a: any) => {
        const title = a?.title || a?.activityId;
        const key = a.activityId || a.id;
        const open = openRow === key;
        const allTargets: string[] = Array.from(new Set(((a?.levels || []).flatMap((l: any) => l.targets || []))));
        const materials = (a?.requirements?.materials || []) as string[];
        const env = (a?.environment || []) as string[];
        const tags = (a?.tags || []) as string[];
        const steps = (a?.steps || []) as { text: string }[];
        const observe = (a?.observe || []) as string[];
        const variations = (a?.variations || []) as string[];
        const cautions = (a?.cautions || []) as string[];
        return (
          <div key={key} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a?.emoji && <span aria-hidden style={{ fontSize: 16 }}>{a.emoji}</span>}
                  <strong>{title}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  {a?.requirements && (
                    <>
                      {a.requirements.duration} min · space: {a.requirements.space}
                    </>
                  )}
                  {env.length > 0 && <> · env: {env.join(', ')}</>}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {tags.map((t: string) => {
                    const emoji = TAG_EMOJI[t] || '🏷️';
                    return (
                      <span
                        key={t}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          border: '1px solid #ddd',
                          background: '#fff',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontSize: 12,
                        }}
                      >
                        <span aria-hidden>{emoji}</span>
                        <span>{t.replace(/_/g, ' ')}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => setOpenRow((prev) => (prev === key ? null : key))}
                style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}
                aria-expanded={open}
                aria-label="Toggle details"
              >
                {open ? '▾' : '▸'}
              </button>
              <button onClick={() => onAdd(a.activityId || a.id)} style={{ marginLeft: 6 }}>
                Add to Centers
              </button>
            </div>

            {open && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#333', display: 'grid', gap: 10 }}>
                {a?.requirements && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Setup</div>
                    <div>
                      <strong>Space:</strong> {a.requirements.space} · <strong>Duration:</strong> {a.requirements.duration} min ·{' '}
                      <strong>Noise:</strong> {a.requirements.noise}
                    </div>
                    <div>
                      <strong>Materials:</strong> {materials.join(', ') || '—'}
                    </div>
                  </div>
                )}
                {steps.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Steps</div>
                    <ol style={{ margin: '4px 0 0 18px' }}>
                      {steps.map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s.text}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {observe.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Observe</div>
                    <ul style={{ margin: '4px 0 0 18px' }}>
                      {observe.map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {variations.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Variations</div>
                    <ul style={{ margin: '4px 0 0 18px' }}>
                      {variations.map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {cautions.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Cautions</div>
                    <ul style={{ margin: '4px 0 0 18px' }}>
                      {cautions.map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Targets</div>
                  {Array.from(new Set(((a?.levels || []).flatMap((l: any) => l.targets || [])))).length === 0 ? (
                    <div style={{ color: '#777' }}>—</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from(new Set(((a?.levels || []).flatMap((l: any) => l.targets || [])))).map((t: string) => (
                        <span key={t} className="badge">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- styles
const th = { border: '1px solid #ececec', padding: '8px', background: '#fafafa', textAlign: 'left' as const };
const td = { border: '1px solid #ececec', padding: '8px', verticalAlign: 'top' as const, background: '#fff' };
const tdStrong = { ...td, fontWeight: 600 };
const btn = { border: '1px solid #ddd', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' };
const smallBtn = { ...btn, padding: '2px 6px', fontSize: 12 };
const pill = { border: '1px solid #eee', borderRadius: 8, padding: 8, background: '#fff' } as const;