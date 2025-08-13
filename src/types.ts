export type Environment = 'home' | 'school' | 'outdoors' | 'clinic'

export type AgeBand = { typicalStart: number; typicalEnd: number }

export type Gate = { type: 'node_min_level'; nodes: string[]; minLevel?: number }

export type Node = {
  id: string
  ladderId: string
  domain: string
  parentId: string | null
  name: string
  description?: string
  ageBand?: AgeBand
  exitCriteria?: string[]
  gates?: Gate[]
  signals?: string[]
  tags?: string[]
}

export type Ladder = { id: string; name: string; rootNodeId: string }

export type Genome = { meta?: any; ladders: Ladder[]; nodes: Node[] }

export type ChildNodeState = {
  level: number     // 0..3 continuous
  confidence: number // 0..1
  evidence?: number  // 0..∞ heuristic
}
export type ChildState = Record<string, ChildNodeState>

export type ActivityStep = { text: string; tip?: string; emoji?: string }
export type MaterialsRef = { id?: string; name: string; quantity?: string }

export type ActivityLink = {
  nodeId: string
  meetsExit: string // verbatim phrase showing how this activity proves mastery
}

export type Activity = {
  id: string
  title: string
  emoji?: string
  environment: Environment[]
  durationMin: number
  materials?: MaterialsRef[]
  steps: ActivityStep[]
  observe?: string[]
  variations?: string[]
  cautions?: string[]
  links: ActivityLink[]
  tags?: string[]
}

export type ActivityIndex = Record<string, Activity>