// --- types (keep yours if already defined) ---
export type Child = { childId: string; name: string; dob: string };
export type Achievement = { nodeId: string; at?: string; evidenceId?: string };
export type AchievementsByChild = Record<string, Achievement[]>;

export type GenomeNode = { id:string; name:string; tags?:string[]; ageBand?:{typicalStart?:number; typicalEnd?:number} };
export type Genome = { nodes: GenomeNode[]; edges: {from:string; to:string; type?:string}[]; ladders?: any[] };

export type ActivityLevel = 'foundational'|'core'|'stretch';
export type Activity = {
  activityId: string;
  title: string;
  levels: { level: ActivityLevel; targets: string[]; adaptations: string[] }[];
  requirements: { space: string; materials: string[]; duration: number; noise: 'low'|'medium'|'high' };
  // Optional rich fields when sourced from visualizer schema
  emoji?: string;
  environment?: string[];
  tags?: string[];
  steps?: { text: string }[];
  observe?: string[];
  variations?: string[];
  cautions?: string[];
  links?: { nodeId: string; meetsExit?: string }[];
};

export type EvidenceSignal = { nodeId:string; observation:string; confidence:number };
export type Evidence = { evidenceId:string; childId:string; activityId:string; time:string; signals:EvidenceSignal[]; notes?:string; media?:string[] };

// --- tiny helper with loud logs ---
async function tryJson(url:string){
  try{
    const r = await fetch(url);
    if(!r.ok){ console.warn('[fetch]', url, '→', r.status); return null; }
    const data = await r.json();
    console.log('[loaded]', url, data && (Array.isArray(data) ? `len=${data.length}` : Object.keys(data)));
    return data;
  }catch(e){
    console.error('[error parsing]', url, e);
    return null;
  }
}

// ---- Timetable loader ----
export type TimetableSlot = { time:string; type:string; desc:string };
export type TimetableAgeGroup = { id:string; label:string; slots:TimetableSlot[] };
export type Timetable = { version:number; days:string[]; ageGroups:TimetableAgeGroup[] };

export async function loadTimetable(): Promise<Timetable> {
  const r = await fetch('/data/metadata/timetable.json');
  if (!r.ok) throw new Error(`Failed to load timetable.json (${r.status})`);
  return r.json();
}

// ---- Weekly plan storage (per day) ----
export type Day = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri';
export type PlanItem = { slotType:string; time:string; activityId:string; nodeId?:string; childIds?: string[] };

const LS_WEEKLY = 'planner.weeklyPlan.v1';

export function loadWeeklyPlan(): Record<Day, PlanItem[]> {
  try { return JSON.parse(localStorage.getItem(LS_WEEKLY) || '{}'); } catch { return {}; }
}
export function saveWeeklyPlan(weekly: Record<Day, PlanItem[]>) {
  localStorage.setItem(LS_WEEKLY, JSON.stringify(weekly));
}


// --- YOUR PATHS: genome from /data/genome.json ---
export async function loadGenome(): Promise<Genome> {
  const g = await tryJson('/data/genome.json')
        || await tryJson('/data/metadata/genome.json')         // optional fallback
        || await tryJson('/data/planner/genome.json');         // optional fallback
  if (!g) throw new Error('Genome not found at /data/genome.json (or fallbacks)');
  return g;
}

// --- YOUR PATHS: activities from /data/activities/activities.json ---
export async function loadActivities(): Promise<Activity[]> {
  const raw = await tryJson('/data/activities/activities.json')
           || await tryJson('/data/activities/index.json')     // optional fallback
           || await tryJson('/data/planner/activities.json')   // optional fallback
           || await tryJson('/data/planner/activities.sample.json'); // last resort
  // accept either {activities:[...]} or raw array
  const arr: any[] = Array.isArray(raw) ? raw : (raw?.activities || []);

  if (!arr || arr.length === 0) { console.warn('[activities] none found'); return []; }

  // If already in planner shape (activityId + levels), pass through
  if (arr[0]?.activityId && Array.isArray(arr[0]?.levels)) {
    console.log('[activities] using planner schema');
    return arr as Activity[];
  }

  // If in visualizer schema (id + links[] -> nodeId), normalize to a minimal planner schema
  if (arr[0]?.id && Array.isArray(arr[0]?.links)) {
    console.log('[activities] normalizing from visualizer schema');
    const norm: Activity[] = arr.map((it: any) => {
      const targets: string[] = (it.links || []).map((l: any) => l?.nodeId).filter(Boolean);
      const materials: string[] = (it.materials || []).map((m: any) => (typeof m === 'string' ? m : m?.name)).filter(Boolean);
      const duration = (typeof it.durationMin === 'number' && it.durationMin > 0) ? it.durationMin : 10;
      return {
        activityId: it.id || it.activityId || `act_${Math.random().toString(36).slice(2,8)}`,
        title: it.title || 'Untitled Activity',
        levels: [
          { level: 'core', targets, adaptations: [] },
        ],
        requirements: { space: 'any', materials, duration, noise: 'medium' },
        // Preserve rich details for rendering in planner UIs
        emoji: it.emoji,
        environment: Array.isArray(it.environment) ? it.environment : undefined,
        tags: Array.isArray(it.tags) ? it.tags : undefined,
        steps: Array.isArray(it.steps) ? it.steps : undefined,
        observe: Array.isArray(it.observe) ? it.observe : undefined,
        variations: Array.isArray(it.variations) ? it.variations : undefined,
        cautions: Array.isArray(it.cautions) ? it.cautions : undefined,
        links: Array.isArray(it.links) ? it.links : undefined,
      };
    });
    return norm;
  }

  console.warn('[activities] unknown schema; attempting best-effort cast');
  return arr as Activity[];
}

// --- Students + achievements from /data/metadata/children.json ---
export async function loadChildrenAndAchievements(){
  const data = await tryJson('/data/metadata/children.json')
           || await tryJson('/data/planner/children.json')     // optional fallback
           || {};
  const children: Child[] = Array.isArray(data.children) ? data.children : [];
  const achieved: AchievementsByChild = data.achieved || {};
  console.log('[children resolved] count =', children.length, 'achieved keys =', Object.keys(achieved).length);
  return { children, achieved };
}

// --- Local storage (evidence / schedule / achievements overlay) ---
const LS = {
  evidence:'planner.evidence.v1',
  schedule:'planner.schedule.v1',
  achievements:'planner.achieved.v1'
};

export function saveEvidence(ev: Evidence){
  const arr = JSON.parse(localStorage.getItem(LS.evidence) || '[]'); arr.push(ev);
  localStorage.setItem(LS.evidence, JSON.stringify(arr));
}
export function listEvidence(): Evidence[]{ try{ return JSON.parse(localStorage.getItem(LS.evidence) || '[]'); }catch{return [];} }
export function clearEvidence(){ localStorage.removeItem(LS.evidence); }

export function saveSchedule(s:any){ localStorage.setItem(LS.schedule, JSON.stringify(s)); }
export function loadSchedule():any|null{ try{ return JSON.parse(localStorage.getItem(LS.schedule) || 'null'); }catch{ return null; } }

export function listAchievementsOverlay(): AchievementsByChild {
  try{ return JSON.parse(localStorage.getItem(LS.achievements) || '{}'); }catch{ return {}; }
}
export function saveAchievement(childId:string, a: Achievement){
  const cur = listAchievementsOverlay();
  (cur[childId] ||= []).push(a);
  localStorage.setItem(LS.achievements, JSON.stringify(cur));
}
export function clearAchievementsOverlay(){ localStorage.removeItem(LS.achievements); }

// --- genome index singleton (ADD THIS) ---
import { buildGenomeIndex, type GenomeIndex } from './genomeEngine';
import type { Genome } from './index'; // if this line errors, just remove it and rely on your local Genome type

let _genomeIndex: GenomeIndex | null = null;

/** Call once after you load the genome JSON */
export function initGenomeIndex(genome: Genome) {
  _genomeIndex = buildGenomeIndex(genome as any);
  return _genomeIndex;
}

/** Used by recommender/derivation code */
export function getGenomeIndex() {
  if (!_genomeIndex) throw new Error('Genome index not initialized — call initGenomeIndex(genome) first.');
  return _genomeIndex;
}

// ----- Achievement utilities -----
export function expandWithParents(ids: string[]): string[] {
  try{
    const idx = getGenomeIndex();
    const out = new Set<string>();
    for (const id of ids) {
      let cur: string | null = id;
      while (cur) {
        if (out.has(cur)) break;
        out.add(cur);
        cur = idx.parent[cur] || null;
      }
    }
    return Array.from(out);
  }catch{
    // if index not ready, just return ids as-is
    return Array.from(new Set(ids));
  }
}

export function computeLevelsFromAchievements(ids: string[]): Record<string, number> {
  const all = expandWithParents(ids);
  const levels: Record<string, number> = {};
  for (const id of all) levels[id] = 3; // mastered
  return levels;
}
