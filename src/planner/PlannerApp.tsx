import React from 'react';
import { PlannerProvider } from './state/PlannerStore';
import { Today } from './views/Today';
import { Plan } from './views/Plan';
import { Review } from './views/Review';

type Tab = 'today'|'plan'|'review';

export default function PlannerApp(){
  const [tab, setTab] = React.useState<Tab>(()=> {
    const h = window.location.hash.replace('#','');
    return (h==='plan'||h==='review') ? h as Tab : 'today';
  });
  React.useEffect(()=> {
    const onHash = ()=> {
      const h = window.location.hash.replace('#','');
      setTab((h==='plan'||h==='review')? h as Tab : 'today');
    };
    window.addEventListener('hashchange', onHash);
    return ()=>window.removeEventListener('hashchange', onHash);
  },[]);

  return (
    <PlannerProvider>
      <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter, system-ui, sans-serif'}}>
        <header style={{padding:'12px 16px',borderBottom:'1px solid #eee',display:'flex',gap:12,alignItems:'center'}}>
          <h1 style={{margin:0,fontSize:18}}>Teacher Planner (Prototype)</h1>
          <nav style={{display:'flex',gap:8,marginLeft:12}}>
            <a href="#today"  style={{textDecoration:'none',padding:'6px 10px',borderRadius:8,background: tab==='today'?'#111':'#f3f3f3', color: tab==='today'?'#fff':'#111'}}>Today</a>
            <a href="#plan"   style={{textDecoration:'none',padding:'6px 10px',borderRadius:8,background: tab==='plan'?'#111':'#f3f3f3',  color: tab==='plan'?'#fff':'#111'}}>Plan</a>
            <a href="#review" style={{textDecoration:'none',padding:'6px 10px',borderRadius:8,background: tab==='review'?'#111':'#f3f3f3',color: tab==='review'?'#fff':'#111'}}>Review</a>
          </nav>
        </header>
        <main style={{flex:1,overflow:'auto'}}>
          {tab==='today'  && <Today/>}
          {tab==='plan'   && <Plan/>}
          {tab==='review' && <Review/>}
        </main>
      </div>
    </PlannerProvider>
  )
}