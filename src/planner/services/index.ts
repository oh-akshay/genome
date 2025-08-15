export type Child = { childId: string; name: string; dob: string };
export type GenomeNode = { id:string; name:string; tags?:string[]; ageBand?:{typicalStart?:number; typicalEnd?:number} };
export type GenomeState = { nodeId:string; status:'emerging'|'secured'|'stretch'; pMastery:number; lastEvidenceAt?:string };

export type ActivityLevel = 'foundational'|'core'|'stretch';
export type Activity = {
  activityId:string;
  title:string;
  levels:{ level:ActivityLevel; targets:string[]; adaptations:string[] }[];
  requirements:{ space:string; materials:string[]; duration:number; noise:'low'|'medium'|'high' }
};

export type EvidenceSignal = { nodeId:string; observation:string; confidence:number };
export type Evidence = { evidenceId:string; childId:string; activityId:string; time:string; signals:EvidenceSignal[]; notes?:string; media?:string[] };

async function tryJson(url:string){
  try{ const r = await fetch(url); if(!r.ok) throw new Error(String(r.status)); return await r.json(); }
  catch{ return null; }
}

export async function loadChildrenAndGenome(){
  const kids = await tryJson('/data/metadata/children.json')
          || await tryJson('/data/planner/children.json')
          || await tryJson('/data/planner/children.sample.json');

  const genome = await tryJson('/data/metadata/genome.json')
            || await tryJson('/data/planner/genome.json')
            || await tryJson('/data/planner/genome.sample.json');

  return { kids, genome };
}

export async function loadActivities(){
  const acts = await tryJson('/data/activities/index.json')
          || await tryJson('/data/planner/activities.json')
          || await tryJson('/data/planner/activities.sample.json');
  return acts;
}

const LS = { evidence:'planner.evidence.v1', schedule:'planner.schedule.v1' };

export function saveEvidence(ev: Evidence){
  const arr = JSON.parse(localStorage.getItem(LS.evidence) || '[]'); arr.push(ev);
  localStorage.setItem(LS.evidence, JSON.stringify(arr));
}
export function listEvidence(): Evidence[]{ return JSON.parse(localStorage.getItem(LS.evidence) || '[]'); }
export function clearEvidence(){ localStorage.removeItem(LS.evidence); }
export function saveSchedule(s:any){ localStorage.setItem(LS.schedule, JSON.stringify(s)); }
export function loadSchedule():any|null{ try{ return JSON.parse(localStorage.getItem(LS.schedule) || 'null'); }catch{ return null; } }