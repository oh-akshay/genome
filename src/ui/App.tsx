// src/ui/App.tsx
import React from 'react'
import type { Genome, ChildState, Node, ActivityIndex, Environment } from '../types'
import { loadGenome, loadActivities } from '../dataLoader'
import { readyScorePlus, statusColor, gateSatisfied, parentMastery, nodeLinks } from '../logic'
import { NextList } from './NextList'
import { TreeCanvas } from './TreeCanvas'

type ExpandedMap = Record<string, Set<string>>
const cloneExpanded = (m: ExpandedMap) => {
  const out: ExpandedMap = {}
  for (const k in m) out[k] = new Set(m[k])
  return out
}
const initialChildState = (g: Genome): ChildState => {
  const s: ChildState = {}
  for (const n of g.nodes) s[n.id] = { level: 0, confidence: 0, evidence: 0 }
  return s
}

export function App() {
  // --- loading state ---
  const [genome, setGenome] = React.useState<Genome | null>(null)
  const [activities, setActivities] = React.useState<ActivityIndex>({})
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // --- app state ---
  const [state, setState] = React.useState<ChildState>({})
  const [age, setAge] = React.useState(12)
  const [expanded, setExpanded] = React.useState<ExpandedMap>({})
  const [selected, setSelected] = React.useState<Node | null>(null)
  const [envFilter, setEnvFilter] = React.useState<Environment[]>(['home', 'school'])
  const [maxMinutes, setMaxMinutes] = React.useState<number>(10)

  // load JSON (public/data/...)
  React.useEffect(() => {
    (async () => {
      try {
        const [g, a] = await Promise.all([loadGenome(), loadActivities()])
        setGenome(g)
        setActivities(a)
        setState(initialChildState(g))
        const m: ExpandedMap = {}
        for (const lad of g.ladders) m[lad.id] = new Set() // collapsed by default
        setExpanded(m)
      } catch (e: any) {
        console.error(e)
        setLoadError(e?.message || String(e))
      }
    })()
  }, [])

  // ---- early renders (INSIDE component) ----
  if (loadError) {
    return (
      <div style={{ padding: 16, color: '#b91c1c', fontFamily: 'system-ui' }}>
        <h3>Failed to load data</h3>
        <div style={{ whiteSpace: 'pre-wrap' }}>{loadError}</div>
        <p style={{ marginTop: 8, color: '#111' }}>
          Check that these files exist and contain valid JSON:
        </p>
        <ul>
          <li><code>public/data/genome.json</code></li>
          <li><code>public/data/activities/activities.json</code> (or <code>public/data/activities.json</code>)</li>
        </ul>
        <p>Then hard refresh (Cmd/Ctrl+Shift+R).</p>
      </div>
    )
  }
  if (!genome) {
    return <div style={{ padding: 16 }}>Loading data…</div>
  }

  // --- compute Next Steps ---
  const next = genome.ladders.map(lad => {
    const nodes = genome.nodes.filter(n => n.ladderId === lad.id)
    const scored = nodes
      .filter(n => gateSatisfied(n, state) >= 1 && (state[n.id]?.level ?? 0) < 2)
      .map(n => ({
        ladderId: lad.id,
        node: n,
        score: readyScorePlus(n, state, age, activities, { env: envFilter, maxMin: maxMinutes })
      }))
      .sort((a, b) => b.score - a.score)
    return scored[0] || null
  }).filter(Boolean) as { ladderId: string; node: Node; score: number }[]
  const nextIds = new Set(next.map(x => x.node.id))

  // --- expand/collapse ---
  const toggleNode = (ladderId: string, nodeId: string) => {
    setExpanded(prev => {
      const m = cloneExpanded(prev)
      const s = m[ladderId] ?? new Set<string>()
      s.has(nodeId) ? s.delete(nodeId) : s.add(nodeId)
      m[ladderId] = s
      return m
    })
  }
  const expandAllInLadder = (ladderId: string) => {
    setExpanded(prev => {
      const m = cloneExpanded(prev)
      const set = m[ladderId] ?? new Set<string>()
      for (const n of genome.nodes.filter(n => n.ladderId === ladderId)) set.add(n.id)
      m[ladderId] = set
      return m
    })
  }
  const collapseAllInLadder = (ladderId: string) => {
    setExpanded(prev => {
      const m = cloneExpanded(prev); m[ladderId] = new Set(); return m
    })
  }

  // --- evidence bump ---
  function bump(nodeId: string, deltaLevel = 0.2, deltaConf = 0.1) {
    setState(s => ({
      ...s,
      [nodeId]: {
        level: Math.min(3, (s[nodeId]?.level ?? 0) + deltaLevel),
        confidence: Math.min(1, (s[nodeId]?.confidence ?? 0) + deltaConf),
        evidence: (s[nodeId]?.evidence ?? 0) + 1
      }
    }))
  }

  // --- path to selected node ---
  const idToNode: Record<string, Node> = Object.fromEntries(genome.nodes.map(n => [n.id, n]))
  const progression: Node[] = []
  if (selected) {
    let cur: Node | undefined = selected
    while (cur) {
      progression.unshift(cur)
      cur = cur.parentId ? idToNode[cur.parentId] : undefined
    }
  }

  // --- render ---
  return (
    <>
      <div className="topbar">
        <div className="brand">Learning Genome – Actionable</div>
        <div className="legend">
          <span><span className="dot" style={{ display: 'inline-block', width: 10, height: 10, background: '#16a34a', borderRadius: 999 }}></span>{' '}mastered (≥2)</span>
          <span><span className="dot" style={{ display: 'inline-block', width: 10, height: 10, background: '#f59e0b', borderRadius: 999 }}></span>{' '}ready</span>
          <span><span className="dot" style={{ display: 'inline-block', width: 10, height: 10, background: '#e5e7eb', borderRadius: 999 }}></span>{' '}locked</span>
          <span><span className="dot" style={{ display: 'inline-block', width: 10, height: 10, background: '#7C5CFF', borderRadius: 999 }}></span>{' '}recommended</span>
        </div>
      </div>

      <div className="layout">
        {/* Controls */}
        <div className="card controls">
          <h3>Controls</h3>
          <div className="row">
            <label>Age (months): {age}</label>
            <input type="range" min={0} max={36} value={age} onChange={e => setAge(parseInt(e.target.value))} />
          </div>

          <div className="row">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Environment</div>
            {(['home', 'school', 'outdoors'] as Environment[]).map(env => {
              const on = envFilter.includes(env)
              return (
                <button key={env} className={`btn ${on ? '' : 'ghost'}`}
                  onClick={() => setEnvFilter(prev => on ? prev.filter(x => x !== env) : [...prev, env])}
                  style={{ marginRight: 6 }}>
                  {env}
                </button>
              )
            })}
          </div>

          <div className="row">
            <label>Max minutes: {maxMinutes}</label>
            <input type="range" min={3} max={20} step={1} value={maxMinutes} onChange={e => setMaxMinutes(parseInt(e.target.value))} />
          </div>

          <div className="row">
            <h4>Next Steps</h4>
            <NextList next={next} />
          </div>
        </div>

        {/* Graph */}
        <div className="card" style={{ padding: 0 }}>
          <TreeCanvas
            genome={genome}
            state={state}
            age={age}
            nextIds={new Set(next.map(n => n.node.id))}
            expanded={expanded}
            colorFor={(n) => statusColor(n, state, new Set(next.map(x => x.node.id)))}
            onToggleNode={toggleNode}
            onSelect={setSelected}
            onExpandAll={expandAllInLadder}
            onCollapseAll={collapseAllInLadder}
          />
        </div>

        {/* Side panel */}
        <div className="card">
          <h3>Skill</h3>
          {!selected && <div style={{ color: '#666' }}>Click a node to view details and activities.</div>}
          {selected && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {progression.map((n, i) => (
                  <React.Fragment key={n.id}>
                    <span className="pill" style={{ background: '#f8fafc' }}>
                      {n.name}
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#666' }}>lvl {(state[n.id]?.level ?? 0).toFixed(1)}</span>
                    </span>
                    {i < progression.length - 1 && <span style={{ opacity: 0.6 }}>{'→'}</span>}
                  </React.Fragment>
                ))}
              </div>

              <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{selected.id}</div>
              {selected.ageBand && (
                <div style={{ marginTop: 6 }}>
                  <span className="badge">typical: {selected.ageBand.typicalStart}-{selected.ageBand.typicalEnd} mo</span>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600 }}>Exit criteria</div>
                <ul>{(selected.exitCriteria || ['-']).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>

              {/* Activities for this node (filtered) */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Activities</h4>
                  <span style={{ fontSize: 12, color: '#666' }}>env: {envFilter.join(', ')} · ≤{maxMinutes} min</span>
                </div>
                {(() => {
                  const links = nodeLinks(selected, activities)
                  const candidates = links
                    .map(l => ({ link: l, act: activities[l.activityId] }))
                    .filter(x => !!x.act)
                    .filter(x => envFilter.some(e => x.act!.environment.includes(e)))
                    .filter(x => x.act!.durationMin <= maxMinutes)

                  if (candidates.length === 0) return <div style={{ color: '#666', marginTop: 6 }}>No matching activities under current filters.</div>

                  return (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {candidates.map(({ act, link }) => (
                        <div key={act!.id} className="pill" style={{ alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{act!.emoji || '🎯'}</span>
                          <div style={{ display: 'grid' }}>
                            <div style={{ fontWeight: 600 }}>{act!.title}</div>
                            <div style={{ fontSize: 12, color: '#555' }}>⏱ {act!.durationMin} min · {act!.environment.join(', ')}</div>
                          </div>
                          <span className="badge" title="How this proves mastery">meets exit: {link.meetsExit}</span>
                          <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => bump(selected.id, 0.2, 0.1)}>
                            Observed
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Readiness rationale */}
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div><b>Parent mastery</b>: {Math.round(parentMastery(selected, state) * 100)}%</div>
                <div>Gates satisfied: {Math.round(gateSatisfied(selected, state) * 100)}%</div>
                <div>Within age band: {selected.ageBand ? (age >= selected.ageBand.typicalStart && age <= selected.ageBand.typicalEnd ? 'yes' : 'nearby') : 'n/a'}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}