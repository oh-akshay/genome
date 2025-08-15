import React from 'react';
import { listEvidence, clearEvidence } from '../services';

export function ExportPanel(){
  const exportJson = ()=>{
    const data = { evidence: listEvidence() };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'evidence-export.json'; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div style={{display:'flex',gap:8}}>
      <button onClick={exportJson}>Export Evidence JSON</button>
      <button onClick={()=>{ if(confirm('Clear all locally saved evidence?')){ clearEvidence(); alert('Cleared.'); location.reload(); }}}>Clear Local Evidence</button>
    </div>
  )
}