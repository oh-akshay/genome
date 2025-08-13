import React from 'react'
import type { Node } from '../types'

export function NextList({next}:{next:{ladderId:string; node: Node; score:number}[]}){
  if(next.length===0) return <div style={{color:'#666'}}>No next items yet.</div>
  return (
    <div style={{display:'grid', gap:8}}>
      {next.map(n=> (
        <div key={n.ladderId} className="pill">
          <b>{n.ladderId.split('.').pop()}</b>
          <span>{' \u2192 '}</span>
          <span>{n.node.name}</span>
          <span style={{marginLeft:'auto'}}>score {n.score.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}