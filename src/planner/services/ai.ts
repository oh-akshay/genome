import { deriveStateForChild, type GenomeIndex } from './genomeEngine';
import { getGenomeIndex } from './index';

export type AISuggestion = {
  childId: string;
  childName: string;
  readiness: 'ready'|'stretch'|'scaffold';
  focusTargets: { id:string; name:string }[];
  notes: string[];
};

export type AISuggestionGroup = {
  readiness: 'ready'|'stretch'|'scaffold';
  focusTargets: { id:string; name:string }[];
  notes: string[];
  childIds: string[];
  childNames: string[];
};

/**
 * Try to call an external LLM endpoint to contextualise an activity for a roster of children.
 * Configure via localStorage:
 *   - planner.ai.endpoint => string (e.g., '/api/ai/contextualize')
 *   - planner.ai.apikey   => optional Bearer token
 * If not configured or call fails, falls back to rule-based suggestions.
 */
export async function contextualiseActivity({
  activity,
  children,
  nodeById,
  getChildAchievements,
}: {
  activity: any;
  children: { childId:string; name:string }[];
  nodeById: Record<string, any>;
  getChildAchievements: (id:string)=>{nodeId:string}[];
}): Promise<AISuggestionGroup[]> {
  const endpoint = safeGet('planner.ai.endpoint');
  const apikey = safeGet('planner.ai.apikey');
  const openaiKey = safeGet('planner.ai.openai.apikey');
  const openaiModel = safeGet('planner.ai.openai.model') || 'gpt-4o-mini';

  const payload = buildLLMPayload(activity, children, nodeById, getChildAchievements);

  // Prefer direct OpenAI if configured. Note: Calling OpenAI directly from the browser may be blocked by CORS
  // and exposes the API key to clients. Prefer a server proxy in production.
  if (openaiKey) {
    try {
      const suggestions = await callOpenAI(openaiKey, openaiModel, payload);
      if (Array.isArray(suggestions)) return suggestions as AISuggestion[];
    } catch (e) {
      console.warn('[ai] openai call failed; will try custom endpoint or fallback', e);
    }
  }

  if (endpoint) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apikey ? { authorization: `Bearer ${apikey}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const data = await r.json();
        // Expected shape: { suggestions: AISuggestion[] }
        if (Array.isArray(data?.groups)) return data.groups as AISuggestionGroup[];
        if (Array.isArray(data?.suggestions)) return groupFromSuggestions(data.suggestions as AISuggestion[]);
      }
      // eslint-disable-next-line no-console
      console.warn('[ai] endpoint returned non-OK or unexpected payload:', r.status);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ai] endpoint call failed, falling back to rules', e);
    }
  }

  // fallback
  return rulesBasedFallbackGrouped(activity, children, nodeById, getChildAchievements);
}

function safeGet(k:string){ try{ return localStorage.getItem(k) || ''; }catch{ return ''; } }

function buildLLMPayload(activity:any, children:{childId:string; name:string}[], nodeById:Record<string, any>, getChildAchievements:(id:string)=>{nodeId:string}[]){
  const idx = tryIndex();
  const targets: string[] = Array.from(new Set(((activity?.levels||[]).flatMap((l:any)=> l.targets || []))));
  const targetDetail = targets.map(id => ({ id, name: nodeById[id]?.name || id }));
  const steps = (activity?.steps||[]).map((s:any)=>s.text);
  const observe = (activity?.observe||[]);
  const variations = (activity?.variations||[]);
  const requirement = activity?.requirements || {};
  const mats = (requirement?.materials || []);
  const materials = mats.map((m:any)=> typeof m === 'string' ? m : (m?.name || '')).filter(Boolean);

  const roster = children.map(c => {
    const ach = getChildAchievements(c.childId) || [];
    let achieved: string[] = [];
    let frontier: string[] = [];
    if (idx){
      const d = deriveStateForChild(idx, ach);
      achieved = Array.from(d.achievedSet);
      frontier = d.frontierAll;
    } else {
      achieved = ach.map(a => a.nodeId);
    }
    return { childId: c.childId, name: c.name, achieved, frontier };
  });

  return {
    task: 'contextualise-activity-v1',
    activity: {
      id: activity.activityId || activity.id,
      title: activity.title,
      targets: targetDetail,
      steps,
      observe,
      variations,
      requirements: { ...requirement, materials },
      tags: activity.tags || [],
    },
    children: roster,
  };
}

function tryIndex(): GenomeIndex|null { try{ return getGenomeIndex(); }catch{ return null; } }

function rulesBasedFallback(activity:any, children:{childId:string; name:string}[], nodeById:Record<string, any>, getChildAchievements:(id:string)=>{nodeId:string}[]): AISuggestion[] {
  const idx = tryIndex();
  const targets: string[] = Array.from(new Set(((activity?.levels||[]).flatMap((l:any)=> l.targets || []))));
  return children.map(c => {
    const ach = getChildAchievements(c.childId) || [];
    let readiness: AISuggestion['readiness'] = 'scaffold';
    let notes: string[] = [];
    let focusTargets = targets.map(id => ({ id, name: nodeById[id]?.name || id }));
    if (idx) {
      const derived = deriveStateForChild(idx, ach);
      const achieved = derived.achievedSet;
      const frontier = new Set(derived.frontierAll);
      const readyHits = targets.filter(t => frontier.has(t));
      const achievedHits = targets.filter(t => achieved.has(t));
      if (readyHits.length > 0) {
        readiness = 'ready';
        notes.push('Minimal prompts; encourage independent attempt on frontier target(s).');
        focusTargets = readyHits.map(id => ({ id, name: nodeById[id]?.name || id }));
      } else if (achievedHits.length > 0) {
        readiness = 'stretch';
        notes.push('Add challenge: increase set size, vary materials, or add 2-step direction.');
        focusTargets = achievedHits.map(id => ({ id, name: nodeById[id]?.name || id }));
      } else {
        readiness = 'scaffold';
        notes.push('Backchain prerequisite: model + hand-over-hand as needed; reduce visual field.');
      }
    } else {
      readiness = 'ready';
      notes.push('Model and wait; tailor language to 2–3 words.');
    }
    return { childId: c.childId, childName: c.name, readiness, focusTargets, notes };
  });
}

function rulesBasedFallbackGrouped(activity:any, children:{childId:string; name:string}[], nodeById:Record<string, any>, getChildAchievements:(id:string)=>{nodeId:string}[]): AISuggestionGroup[] {
  const sugg = rulesBasedFallback(activity, children, nodeById, getChildAchievements);
  return groupFromSuggestions(sugg);
}

function groupFromSuggestions(sugg: AISuggestion[]): AISuggestionGroup[] {
  const groups: Record<string, AISuggestionGroup> = {};
  for (const sg of sugg) {
    const key = JSON.stringify({ r: sg.readiness, n: sg.notes });
    if (!groups[key]) groups[key] = { readiness: sg.readiness, notes: sg.notes, focusTargets: sg.focusTargets, childIds: [], childNames: [] };
    groups[key].childIds.push(sg.childId);
    groups[key].childNames.push(sg.childName);
    // Merge focus targets by id to avoid duplicates
    const ftIds = new Set(groups[key].focusTargets.map(f => f.id));
    for (const f of sg.focusTargets) if (!ftIds.has(f.id)) groups[key].focusTargets.push(f);
  }
  return Object.values(groups);
}

async function callOpenAI(apiKey:string, model:string, payload:any): Promise<AISuggestionGroup[]|null> {
  try{
    const sys = [
      'You are an expert early childhood and special educator.',
      'Given a base classroom activity and a roster of children with genome states (achieved and frontier node IDs),',
      'produce grouped, actionable facilitation guidance for today\'s session.',
      'Cluster children who should receive materially identical instructions to reduce teacher load.',
      'Output strict JSON with {"groups": [{"readiness","focusTargets":[{"id","name"}],"notes":["..."],"childIds":["..."],"childNames":["..."]}...]}.',
      'Use readiness values: "ready" | "stretch" | "scaffold". Keep notes concrete and classroom-friendly.',
    ].join(' ');

    const body = {
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    } as any;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[openai] http', res.status, await safeText(res));
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      try {
        const obj = JSON.parse(content);
        if (Array.isArray(obj?.groups)) return obj.groups as AISuggestionGroup[];
        if (Array.isArray(obj?.suggestions)) return groupFromSuggestions(obj.suggestions as AISuggestion[]);
      } catch {
        // try to extract from code fence if present
        const m = content.match(/```json\s*([\s\S]*?)```/i);
        if (m) {
          try {
            const obj2 = JSON.parse(m[1]);
            if (Array.isArray(obj2?.groups)) return obj2.groups as AISuggestionGroup[];
            if (Array.isArray(obj2?.suggestions)) return groupFromSuggestions(obj2.suggestions as AISuggestion[]);
          } catch {}
        }
      }
    }
    return null;
  }catch(e){
    console.warn('[openai] call failed', e);
    return null;
  }
}

async function safeText(res: Response){ try{ return await res.text(); }catch{ return ''; } }
