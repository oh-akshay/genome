import React from 'react';
import type { Child } from '../services';

export function ChildChip({c, selected, onToggle}:{c:Child; selected?:boolean; onToggle?:(id:string)=>void}){
  return (
    <button onClick={()=>onToggle?.(c.childId)}
      style={{border:'1px solid #ddd', borderRadius:20, padding:'6px 10px', background:selected?'#111':'#fff', color:selected?'#fff':'#111'}}>
      {c.name}
    </button>
  )
}