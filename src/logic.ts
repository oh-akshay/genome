import type { Node, ChildState, ActivityIndex, Environment } from './types'

export function parentMastery(node: Node, state: ChildState){ 
  const s = state[node.id]; return s ? Math.min(1, s.level/2.0) : 0 
}

export function gateSatisfied(node: Node, state: ChildState){
  if (!node.gates || node.gates.length===0) return 1
  let ok = 1
  for (const g of node.gates){
    if (g.type !== 'node_min_level') continue
    const min = g.minLevel ?? 1
    const all = g.nodes.every(id => (state[id]?.level ?? 0) >= min)
    ok = Math.min(ok, all ? 1 : 0)
  }
  return ok
}

export function ageProximityScore(ageMo: number, band?: {typicalStart:number; typicalEnd:number}){
  if (!band) return 0.8
  const s = band.typicalStart, e = band.typicalEnd
  if (ageMo >= s && ageMo <= e) return 1
  if (ageMo < s) return Math.max(0.5, 1 - (s - ageMo) * 0.2)  // 2mo early -> 0.6
  return Math.max(0.6, 1 - (ageMo - e) * 0.1)                  // 3mo late -> 0.7
}

export function activityCoverage(node: Node, acts: ActivityIndex, filters: { env?: Environment[]; maxMin?: number }){
  const links = nodeLinks(node, acts)
  if (links.length === 0) return 0
  const candidates = links
    .map(l => acts[l.activityId!])
    .filter(Boolean)
    .filter(a => (!filters.env || filters.env.some(x => a.environment.includes(x))))
    .filter(a => (!filters.maxMin || a.durationMin <= filters.maxMin))
  return Math.min(1, candidates.length / Math.max(2, links.length))
}

export function readyScorePlus(node: Node, state: ChildState, ageMo: number, acts: ActivityIndex, filters:{env?:Environment[], maxMin?:number}){
  const w = { parent:0.35, gates:0.30, conf:0.15, age:0.10, acts:0.10 }
  const parent = parentMastery(node, state)
  const gates  = gateSatisfied(node, state)
  const conf   = Math.min(1, state[node.id]?.confidence ?? 0)
  const ageS   = ageProximityScore(ageMo, node.ageBand)
  const actsS  = activityCoverage(node, acts, filters)
  return w.parent*parent + w.gates*gates + w.conf*conf + w.age*ageS + w.acts*actsS
}

export function statusColor(n: Node, state: ChildState, nextIds: Set<string>){
  const lvl = state[n.id]?.level ?? 0
  if (lvl >= 2) return '#16a34a' // mastered
  if (nextIds.has(n.id)) return '#7C5CFF' // recommended
  // ready if gates ok and within age-ish
  const gates = gateSatisfied(n, state)
  if (gates >= 1) return '#f59e0b'
  return '#e5e7eb'
}

// Utility: get all links for a node from activity index
export function nodeLinks(node: Node, acts: ActivityIndex){
  const links: { activityId: string, meetsExit: string }[] = []
  for (const a of Object.values(acts)){
    for (const link of (a.links || [])){
      if (link.nodeId === node.id) links.push({ activityId: a.id, meetsExit: link.meetsExit })
    }
  }
  return links
}