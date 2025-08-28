import type { MindMap, Environment, Materials } from './index';
import type { Timetable } from './index';

/**
 * Inputs:
 * - mindMap (for chosen theme + age)
 * - timetable (slots Mon–Fri)
 * - activities (your activities array)
 * - constraints: environment, materials
 *
 * Output:
 * - weekly plan Record<Day, PlanItem[]>
 */
export type Day = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri';
export type PlanItem = { slotType: string; time: string; activityId: string; nodeId?: string };

type Activity = {
  activityId?: string;
  id?: string;
  title: string;
  tags?: string[];
  environment?: string[];
  requirements?: { materials?: string[]; space?: string; duration?: number };
  links?: { nodeId: string; meetsExit?: string }[]; // primary node first
};

function normalizeId(a: Activity) { return a.activityId || a.id || ''; }

/** Simple scoring: tags match + materials available + zone compatibility. */
function activityScore(a: Activity, desiredTags: string[], materials: Materials, env: Environment): number {
  let score = 0;
  const tags = new Set(a.tags || []);
  desiredTags.forEach(t => { if (tags.has(t)) score += 2; });

  const need = new Set(a.requirements?.materials || []);
  const have = new Set(materials.materials);
  const forbidden = new Set(materials.forbidden || []);
  for (const m of need) {
    if (forbidden.has(m)) return -999; // hard block
    if (have.has(m)) score += 1;
    else score -= 1; // small penalty
  }

  // environment compatibility (if activity lists any, require overlap with a zone's allowedTags)
  if (a.environment && a.environment.length) {
    const allAllowed = new Set(env.zones.flatMap(z => z.allowedTags));
    const anyOk = (a.tags || []).some(t => allAllowed.has(t));
    if (!anyOk) score -= 2;
  }

  // prefer activities with a primary node
  if (a.links && a.links.length) score += 1;

  return score;
}

export function generateWeeklyPlan(
  mind: MindMap,
  timetable: Timetable,
  activities: Activity[],
  materials: Materials,
  env: Environment
): Record<Day, PlanItem[]> {

  const days = (timetable?.days || ['Mon','Tue','Wed','Thu','Fri']) as Day[];
  const slots = (timetable.ageGroups?.[0]?.slots || []) as {time:string; type:string}[]; // caller should pass the age-specific group; keep simple

  // Find week 1 focus (you can make this param)
  const week = mind.weeks.find(w => w.week === 1) || mind.weeks[0];
  const desiredTags = week?.primaryTags || [];
  const targetNodes = new Set(week?.targetNodeIds || []);

  // Rank all activities once
  const ranked = activities
    .map(a => ({ a, score: activityScore(a, desiredTags, materials, env) }))
    .filter(x => x.score > -500 && normalizeId(x.a))
    .sort((x,y) => y.score - x.score);

  // Greedy fill: For each day/slot, pick the next best unused activity (rotate through ranked)
  const used = new Set<string>();
  const weekly: Record<Day, PlanItem[]> = {};
  days.forEach(d => { weekly[d] = []; });

  let cursor = 0;
  for (const d of days) {
    for (const slot of slots) {
      const slotType = slot.type; // "Activity A/B/C" etc. or non-teaching slots; we’ll only fill Activity* & Circle Time
      const isFillable = /Activity [ABC]|Circle Time|Read Aloud|Standalone|Language|Numeracy/i.test(slotType);
      if (!isFillable) continue;

      // pick next ranked activity not used yet and (optionally) aligned to target nodes
      let choice: Activity | null = null;
      let spins = 0;
      while (spins < ranked.length) {
        const item = ranked[cursor % ranked.length].a;
        cursor++;
        spins++;
        const id = normalizeId(item);
        if (!id || used.has(id)) continue;

        if (targetNodes.size > 0) {
          const primaryNode = item.links?.[0]?.nodeId;
          if (primaryNode && !targetNodes.has(primaryNode)) {
            // allow but deprioritize – try a few more first
            continue;
          }
        }

        choice = item;
        break;
      }

      if (!choice) continue;
      const id = normalizeId(choice);
      used.add(id);
      weekly[d].push({
        slotType,
        time: slot.time,
        activityId: id,
        nodeId: choice.links?.[0]?.nodeId
      });
    }
  }

  return weekly;
}