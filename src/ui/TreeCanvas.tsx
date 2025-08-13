import React from 'react'
import * as d3 from 'd3'
import type { Genome, Node } from '../types'

type Props = {
  genome: Genome
  state: any
  age: number
  nextIds: Set<string>
  expanded: Record<string, Set<string>>
  colorFor: (n: Node) => string
  onSelect: (n: Node) => void
  onToggleNode: (ladderId: string, nodeId: string) => void
  onExpandAll: (ladderId: string) => void
  onCollapseAll: (ladderId: string) => void
}

/** Fixed node dimensions so layout is stable regardless of label length */
const NODE_W = 220
const NODE_H = 72
const COL_GAP = 120          // min horizontal gap between ladders
const BASE_SIBLING_GAP = 90  // min vertical gap between siblings
const T = 260                // ms for transitions
const PADDING_X = 12

export function TreeCanvas({
  genome, state, nextIds, expanded,
  colorFor, onSelect, onToggleNode, onExpandAll, onCollapseAll
}: Props) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const spaceDownRef = React.useRef(false)

  // Figma-like panning: hold spacebar to pan, wheel to zoom
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDownRef.current = true }
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDownRef.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  React.useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const width  = svgRef.current?.clientWidth  || 1200
    const height = svgRef.current?.clientHeight || 800

    // Root group + zoom
    const rootG = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .filter((ev: any) => {
        if (ev.type === 'wheel') return true
        // drag to pan only while holding Space
        if (ev.type === 'mousedown' || ev.type === 'pointerdown') return spaceDownRef.current
        return true
      })
      .scaleExtent([0.4, 2.5])
      .on('zoom', (ev) => rootG.attr('transform', ev.transform.toString()))
    svg.call(zoom as any).call(zoom.transform as any, d3.zoomIdentity.translate(24, 36).scale(0.95))

    // Arrow marker for edges
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 10).attr('refY', 5)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto-start-reverse')
      .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', '#cbd5e1')

    const colWidth = Math.max(NODE_W + COL_GAP, width / Math.max(1, genome.ladders.length))

    // Text wrap helper: returns up to 2 lines with ellipsis
    const measure = document.createElement('canvas').getContext('2d')!
    measure.font = '600 14px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    const wrap2 = (s: string, maxPx: number) => {
      const words = s.split(/\s+/)
      const lines: string[] = []
      let cur = ''
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w
        if (measure.measureText(trial).width <= maxPx) cur = trial
        else { if (cur) lines.push(cur); cur = w }
      }
      if (cur) lines.push(cur)
      if (lines.length <= 2) return lines
      const keep = [lines[0], lines.slice(1).join(' ')]
      let last = keep[1]
      while (measure.measureText(last + '…').width > maxPx && last.length > 2) last = last.slice(0, -1)
      keep[1] = last + '…'
      return keep
    }

    // Draw each ladder as an independent column
    genome.ladders.forEach((ladder, idx) => {
      const ladderId = ladder.id
      const nodes = genome.nodes.filter(n => n.ladderId === ladderId)
      const byId: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.id, n]))
      const root = byId[ladder.rootNodeId]
      if (!root) return

      // Full children map (for chevrons)
      const childrenFull = (id: string | null) => nodes.filter(n => n.parentId === id)
      const hasChildMap: Record<string, boolean> = {}
      for (const n of nodes) hasChildMap[n.id] = childrenFull(n.id).length > 0

      // Pruned tree based on expanded set
      const expandedSet = expanded[ladderId] ?? new Set<string>()
      const buildPruned = (n: Node): any => ({
        ...n,
        children: expandedSet.has(n.id) ? childrenFull(n.id).map(buildPruned) : []
      })
      const h = d3.hierarchy(buildPruned(root))

      // Auto vertical spacing based on visible nodes
      const visibleCount = Math.max(1, h.descendants().length)
      const usableH = Math.max(360, height - 160)
      const vGap = Math.max(BASE_SIBLING_GAP, Math.min(130, Math.floor(usableH / Math.max(4, visibleCount / 1.25))))

      // Tidy layout (stable ordering), then shift into the ladder column
      const tree = d3.tree<any>()
        .nodeSize([NODE_W + 80, NODE_H + vGap])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.3))
      const laid = tree(h)
      const nodesLaid = laid.descendants()
      const linksLaid = laid.links()

      const baseX = idx * colWidth + 20
      const baseY = 64

      // Column header & controls
      const head = rootG.append('g').attr('transform', `translate(${idx * colWidth}, 0)`)
      head.append('text')
        .attr('x', 8).attr('y', 18).attr('fill', '#0f172a').attr('font-weight', 800).attr('font-size', 14)
        .text(ladder.name)
      const controls = head.append('g').attr('transform', `translate(${colWidth - 165}, 2)`)
      const mkBtn = (label: string, x: number, onClick: () => void) => {
        const g = controls.append('g').attr('transform', `translate(${x},0)`).style('cursor', 'pointer').on('click', onClick)
        g.append('rect').attr('width', 74).attr('height', 24).attr('rx', 8).attr('ry', 8).attr('fill', '#f1f5f9').attr('stroke', '#e2e8f0')
        g.append('text').attr('x', 37).attr('y', 12).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 11).attr('fill', '#334155').text(label)
      }
      mkBtn('Expand all', 0, () => onExpandAll(ladderId))
      mkBtn('Collapse', 86, () => onCollapseAll(ladderId))

      // Column divider
      rootG.append('line').attr('x1', idx * colWidth).attr('y1', 26).attr('x2', idx * colWidth).attr('y2', height).attr('stroke', '#e5e7eb')

      // Layers (edges behind nodes)
      const edgesLayer = rootG.append('g')
      const nodesLayer = rootG.append('g')

      // --- EDGES (curved, animated) ---
      const edgeSel = edgesLayer.selectAll('path.edge')
        .data(linksLaid, (d: any) => `${ladderId}:${d.target.data.id}`)

      edgeSel.enter()
        .append('path')
        .attr('class', 'edge')
        .attr('marker-end', 'url(#arrow)')
        .attr('opacity', 0)
        .attr('d', d => {
          const x = baseX + d.source.x, y = baseY + d.source.y + NODE_H / 2
          return `M${x},${y} C ${x},${y} ${x},${y} ${x},${y}`
        })
        .transition().duration(T).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('d', d => {
          const x1 = baseX + d.source.x, y1 = baseY + d.source.y + NODE_H / 2
          const x2 = baseX + d.target.x, y2 = baseY + d.target.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return `M${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`
        })

      edgeSel.transition().duration(T).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('d', d => {
          const x1 = baseX + d.source.x, y1 = baseY + d.source.y + NODE_H / 2
          const x2 = baseX + d.target.x, y2 = baseY + d.target.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return `M${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`
        })

      edgeSel.exit().transition().duration(T).attr('opacity', 0).remove()

      // --- NODES (fixed size, wrapped labels, chevrons) ---
      const nodeSel = nodesLayer.selectAll('g.node')
        .data(nodesLaid, (d: any) => `${ladderId}:${d.data.id}`)

      const nodeEnter = nodeSel.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d: any) => {
          const p = d.parent || d
          return `translate(${baseX + p.x - NODE_W / 2},${baseY + p.y})`
        })
        .attr('opacity', 0)

      // Node body
      nodeEnter.append('rect')
        .attr('width', NODE_W).attr('height', NODE_H)
        .attr('rx', 12).attr('ry', 12)
        .attr('fill', (d: any) => colorFor(d.data as Node))
        .attr('stroke', (d: any) => nextIds.has((d.data as any).id) ? '#4c3cff' : '#fff')
        .attr('stroke-width', (d: any) => nextIds.has((d.data as any).id) ? 2 : 1)
        .style('cursor', 'pointer')
        .on('click', (_, d: any) => onSelect(d.data as Node))

      // Chevron (always visible if expandable in the FULL tree)
      nodeEnter.append('text')
        .attr('class', 'chev')
        .attr('x', NODE_W - 16).attr('y', 18)
        .text((d: any) => {
          const id = (d.data as Node).id
          if (!hasChildMap[id]) return ''
          return (expandedSet.has(id) ? '▾' : '▸')
        })
        .on('click', (_, d: any) => onToggleNode(ladderId, (d.data as Node).id))

      // Label (2-line wrap)
      nodeEnter.each(function (d: any) {
        const name: string = d.data.name
        const lines = wrap2(name, NODE_W - PADDING_X * 2)
        const label = d3.select(this).append('text').attr('class', 'label').attr('fill', '#0f172a')
        lines.forEach((ln, i) => {
          label.append('tspan').attr('x', PADDING_X).attr('y', 24 + i * 16).text(ln)
        })
      })

      // Level line
      nodeEnter.append('text')
        .attr('class', 'label-muted')
        .attr('x', PADDING_X).attr('y', NODE_H - 10)
        .text((d: any) => `lvl ${(state[d.data.id]?.level ?? 0).toFixed(1)}`)

      // Enter transition
      nodeEnter.transition().duration(T).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('transform', (d: any) => `translate(${baseX + d.x - NODE_W / 2},${baseY + d.y})`)

      // Update transition
      nodeSel.transition().duration(T).ease(d3.easeCubicOut)
        .attr('transform', (d: any) => `translate(${baseX + d.x - NODE_W / 2},${baseY + d.y})`)
        .attr('opacity', 1)
        .select('rect')
          .attr('fill', (d: any) => colorFor(d.data as Node))
          .attr('stroke', (d: any) => nextIds.has((d.data as any).id) ? '#4c3cff' : '#fff')
          .attr('stroke-width', (d: any) => nextIds.has((d.data as any).id) ? 2 : 1)

      // Update chevrons for current expanded state
      nodeSel.select<SVGTextElement>('text.chev')
        .text((d: any) => {
          const id = (d.data as Node).id
          if (!hasChildMap[id]) return ''
          return (expandedSet.has(id) ? '▾' : '▸')
        })

      // Exit transition
      nodeSel.exit().transition().duration(T).attr('opacity', 0).remove()
    })
  }, [genome, state, nextIds, expanded, colorFor, onSelect, onToggleNode, onExpandAll, onCollapseAll])

  return <svg ref={svgRef} />
}