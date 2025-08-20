import React from 'react';

/**
 * Planner store – centralizes genome/activities/children plus
 * NEW: timetable, weekly plan, selectedDay, planningMode.
 *
 * This file only depends on services/index.ts functions.
 */
import {
  loadGenome,
  loadActivities,
  loadChildrenAndAchievements,
  listEvidence,
  saveEvidence,
  listAchievementsOverlay,
  saveAchievement as svcSaveAchievement,
  // schedule persistence (legacy Today/Plan)
  saveSchedule,
  loadSchedule,
  // genome helpers for expanding achievements
  initGenomeIndex,
  expandWithParents,
  computeLevelsFromAchievements,
  // NEW: timetable + weekly plan
  loadTimetable,
  loadWeeklyPlan,
  saveWeeklyPlan,
  type Timetable,
  type Day,
  type PlanItem,
} from '../services';

type Child = { childId: string; name: string };
type Activity = { activityId?: string; id?: string; title: string };
type Evidence = {
  evidenceId: string;
  childId: string;
  activityId: string;
  time: string; // ISO
  signals?: { nodeId: string; observation?: string; confidence?: number }[];
  notes?: string;
};

// Legacy schedule blocks used by Today/Plan
type ScheduleBlock = { blockId:string; title:string; assigned: { activityId:string; childIds:string[]; level:'foundational'|'core'|'stretch' }[] };

type ContextShape = {
  // data
  genome: any | null;
  activities: Activity[];
  children: Child[];
  evidence: Evidence[];
  // legacy schedule for Today/Plan
  schedule: ScheduleBlock[];
  setSchedule: (s: ScheduleBlock[]) => void;
  getChildAchievements: (childId: string) => { nodeId: string; at?: string }[];
  saveAchievement: (childId: string, a: { nodeId: string; at?: string }) => void;

  // timetable + weekly plan
  timetable: Timetable | null;
  weeklyPlan: Record<Day, PlanItem[]>;
  selectedAgeGroupId: string;
  setSelectedAgeGroupId: (id: string) => void;

  // ui state
  selectedDay: Day;
  setSelectedDay: (d: Day) => void;
  planningMode: 'day' | 'week';
  setPlanningMode: (m: 'day' | 'week') => void;

  // mutators
  addEvidence: (e: Evidence) => void;
  addWeeklyItem: (day: Day, item: PlanItem) => void;
  removeWeeklyItem: (day: Day, idx: number) => void;

};

const PlannerContext = React.createContext<ContextShape | null>(null);
export const usePlanner = () => {
  const ctx = React.useContext(PlannerContext);
  if (!ctx) throw new Error('PlannerProvider missing');
  return ctx;
};

export function PlannerProvider({ children: ui }: { children: React.ReactNode }) {
  const [genome, setGenome] = React.useState<any[] | null>(null);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [kids, setKids] = React.useState<Child[]>([]);
  const [evidence, setEvidence] = React.useState<Evidence[]>([]);
  // legacy schedule support
  const defaultSchedule: ScheduleBlock[] = [
    { blockId:'arrival', title:'Arrival', assigned:[] },
    { blockId:'centers', title:'Centers', assigned:[] },
    { blockId:'circle', title:'Circle Time', assigned:[] },
    { blockId:'outdoor', title:'Outdoor', assigned:[] },
    { blockId:'closing', title:'Closing', assigned:[] }
  ];
  const [schedule, setSchedule] = React.useState<ScheduleBlock[]>(loadSchedule() || defaultSchedule);
  const [baseAchieved, setBaseAchieved] = React.useState<Record<string, { nodeId:string; at?:string }[]>>({});
  const [overlayAchieved, setOverlayAchieved] = React.useState<Record<string, { nodeId:string; at?:string }[]>>(listAchievementsOverlay());

  // NEW
  const [timetable, setTimetable] = React.useState<Timetable | null>(null);
  const [weeklyPlan, setWeeklyPlan] = React.useState<Record<Day, PlanItem[]>>(loadWeeklyPlan());
  const [selectedAgeGroupId, setSelectedAgeGroupId] = React.useState<string>('');
  const [selectedDay, setSelectedDay] = React.useState<Day>('Mon');
  const [planningMode, setPlanningMode] = React.useState<'day' | 'week'>('day');

  // persist schedule when changed
  React.useEffect(() => { try { saveSchedule(schedule); } catch {} }, [schedule]);

  // boot – load all baseline data
  React.useEffect(() => {
    (async () => {
      try {
        // genome
        try {
          const g = await loadGenome();
          if (g) {
            try { initGenomeIndex(g as any); } catch {}
            const nodes = (g as any)?.nodes || [];
            setGenome(Array.isArray(nodes) ? nodes : []);
          }
        } catch (e) { console.warn('[boot] genome load failed', e); setGenome([]); }

        // activities
        try {
          const acts = await loadActivities();
          setActivities(acts as Activity[]);
        } catch (e) { console.warn('[boot] activities load failed', e); setActivities([]); }

        // children + base achievements
        try {
          const kidsAndAch = await loadChildrenAndAchievements();
          setKids((kidsAndAch?.children as Child[]) || []);
          setBaseAchieved((kidsAndAch?.achieved as any) || {});
        } catch (e) { console.warn('[boot] children load failed', e); setKids([]); setBaseAchieved({}); }

        // evidence (sync)
        try { setEvidence(listEvidence() as any); } catch { setEvidence([] as any); }

        // timetable (optional)
        try { const tt = await loadTimetable(); if (tt) { setTimetable(tt as any); try{ setSelectedAgeGroupId((tt as any).ageGroups?.[0]?.id || ''); }catch{} } } catch (e) { console.warn('[boot] timetable load failed', e); }
      } catch (err) {
        console.error('[boot] unexpected failure', err);
      }
    })();
  }, []);

  // mutators
  const addEvidence = React.useCallback((e: Evidence) => {
    setEvidence((prev) => {
      const next = [...prev, e];
      // persist via service if available
      try {
        saveEvidence(e);
      } catch {}
      return next;
    });
  }, []);

  const addWeeklyItem = React.useCallback((day: Day, item: PlanItem) => {
    setWeeklyPlan((prev) => {
      const next = { ...prev, [day]: [...(prev[day] || []), item] };
      saveWeeklyPlan(next);
      return next;
    });
  }, []);

  const removeWeeklyItem = React.useCallback((day: Day, idx: number) => {
    setWeeklyPlan((prev) => {
      const arr = [...(prev[day] || [])];
      if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
      const next = { ...prev, [day]: arr };
      saveWeeklyPlan(next);
      return next;
    });
  }, []);

  const value: ContextShape = {
    genome,
    activities,
    children: kids,
    evidence,
    schedule,
    setSchedule,
    getChildAchievements: (childId: string) => {
      const base = baseAchieved?.[childId] || [];
      const overlay = overlayAchieved?.[childId] || [];
      return [...base, ...overlay];
    },
    saveAchievement: (childId: string, a: { nodeId: string; at?: string }) => {
      try {
        // expand with parents for consistency
        const ids = expandWithParents([a.nodeId]);
        const current = listAchievementsOverlay();
        const existing = new Set<string>((current[childId] || []).map(x => x.nodeId));
        for (const id of ids) { if (!existing.has(id)) svcSaveAchievement(childId, { nodeId: id, at: a.at }); }
        setOverlayAchieved(listAchievementsOverlay());

        // update per-child levels for main visualizer
        try {
          const base = (baseAchieved?.[childId] || []).map(x => x.nodeId);
          const overlay = (listAchievementsOverlay()?.[childId] || []).map(x => x.nodeId);
          const levels = computeLevelsFromAchievements([...base, ...overlay]);
          localStorage.setItem(`planner.child.${childId}.levels`, JSON.stringify(levels));
        } catch {}
      } catch {}
    },

    timetable,
    weeklyPlan,
    selectedAgeGroupId,
    setSelectedAgeGroupId,

    selectedDay,
    setSelectedDay,
    planningMode,
    setPlanningMode,

    addEvidence,
    addWeeklyItem,
    removeWeeklyItem,
  };

  return <PlannerContext.Provider value={value}>{ui}</PlannerContext.Provider>;
}
