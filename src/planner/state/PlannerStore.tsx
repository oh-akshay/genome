import React from 'react';
import {
  loadChildrenAndAchievements,
  loadActivities,
  loadGenome,
  saveEvidence,
  listEvidence,
  saveSchedule,
  loadSchedule,
  listAchievementsOverlay,
  saveAchievement as svcSaveAchievement,
  initGenomeIndex,
  getGenomeIndex,
  expandWithParents,
  computeLevelsFromAchievements,
} from '../services';
import type {
  Activity,
  ActivityLevel,
  Child,
  Evidence,
  GenomeNode,
  Achievement,
  AchievementsByChild,
} from '../services';

export type ScheduleBlock = { blockId:string; title:string; assigned: { activityId:string; childIds:string[]; level:ActivityLevel }[] };

type PlannerContextType = {
  children: Child[];
  genome: GenomeNode[];
  activities: Activity[];
  schedule: ScheduleBlock[];
  addEvidence: (ev: Evidence) => void;
  evidence: Evidence[];
  setSchedule: (s: ScheduleBlock[]) => void;
  getChildAchievements: (childId: string) => Achievement[];
  saveAchievement: (childId: string, a: Achievement) => void;
};

const PlannerContext = React.createContext<PlannerContextType | null>(null);

const defaultSchedule: ScheduleBlock[] = [
  { blockId:'arrival', title:'Arrival', assigned:[] },
  { blockId:'centers', title:'Centers', assigned:[] },
  { blockId:'circle', title:'Circle Time', assigned:[] },
  { blockId:'outdoor', title:'Outdoor', assigned:[] },
  { blockId:'closing', title:'Closing', assigned:[] }
];

export function PlannerProvider({children}:{children: React.ReactNode}){
  const [kids, setKids] = React.useState<Child[]>([]);
  const [genome, setGenome] = React.useState<GenomeNode[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleBlock[]>(loadSchedule() || defaultSchedule);
  const [evidence, setEvidence] = React.useState<Evidence[]>(listEvidence());
  const [baseAchieved, setBaseAchieved] = React.useState<AchievementsByChild>({});
  const [overlayAchieved, setOverlayAchieved] = React.useState<AchievementsByChild>(listAchievementsOverlay());

  React.useEffect(()=>{ (async()=>{
    // Load children + achievements
    const { children: ckids, achieved } = await loadChildrenAndAchievements();
    setKids(ckids || []);
    setBaseAchieved(achieved || {});

    // Load genome and init index for recommendations
    try {
      const g = await loadGenome();
      setGenome(g?.nodes || []);
      initGenomeIndex(g as any);
    } catch (e) {
      // non-fatal for planner views; recommender will throw if used before init
      // eslint-disable-next-line no-console
      console.warn('Genome load failed (planner will still work):', e);
    }

    // Load activities (array)
    const acts = await loadActivities();
    setActivities(acts || []);
  })(); },[]);

  const addEvidence = (ev: Evidence)=>{ saveEvidence(ev); setEvidence(listEvidence()); };

  React.useEffect(()=>{ saveSchedule(schedule); }, [schedule]);

  const getChildAchievements = (childId: string): Achievement[] => {
    const base = baseAchieved?.[childId] || [];
    const overlay = overlayAchieved?.[childId] || [];
    return [...base, ...overlay];
  };

  const saveAchievement = (childId: string, a: Achievement) => {
    // Expand to include parents so hierarchy stays consistent
    const ids = expandWithParents([a.nodeId]);
    const current = listAchievementsOverlay();
    const existing = new Set<string>((current[childId] || []).map(x => x.nodeId));
    for (const id of ids) {
      if (!existing.has(id)) svcSaveAchievement(childId, { nodeId: id, at: a.at });
    }
    setOverlayAchieved(listAchievementsOverlay());

    // Write per-child levels for the visualizer to ensure immediate consistency
    try {
      const base = (baseAchieved?.[childId] || []).map(x => x.nodeId);
      const overlay = (listAchievementsOverlay()?.[childId] || []).map(x => x.nodeId);
      const levels = computeLevelsFromAchievements([...base, ...overlay]);
      localStorage.setItem(`planner.child.${childId}.levels`, JSON.stringify(levels));
    } catch {}
  };

  return (
    <PlannerContext.Provider value={{children:kids, genome, activities, schedule, setSchedule, addEvidence, evidence, getChildAchievements, saveAchievement}}>
      {children}
    </PlannerContext.Provider>
  )
}
export function usePlanner(){ const ctx = React.useContext(PlannerContext); if(!ctx) throw new Error('PlannerContext missing'); return ctx; }
