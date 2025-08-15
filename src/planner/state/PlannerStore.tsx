
import React from 'react';

export type GenomeState = {
  nodeId: string;
  status: 'emerging' | 'secured' | 'stretch';
  pMastery: number;
  lastEvidenceAt?: string;
};

export type Child = {
  childId: string;
  name: string;
  dob: string;
  genome: GenomeState[];
};

export type ActivityLevel = 'foundational' | 'core' | 'stretch';
export type Activity = {
  activityId: string;
  title: string;
  levels: { level: ActivityLevel; targets: string[]; adaptations: string[] }[];
  requirements: { space: string; materials: string[]; duration: number; noise: 'low'|'medium'|'high' };
};

export type EvidenceSignal = { nodeId: string; observation: string; confidence: number };
export type Evidence = {
  evidenceId: string;
  childId: string;
  activityId: string;
  time: string;
  signals: EvidenceSignal[];
  notes?: string;
  media?: string[];
};

type PlannerContextType = {
  children: Child[];
  activities: Activity[];
  schedule: { blockId: string; title: string; assigned: { activityId: string; childIds: string[]; level: ActivityLevel }[] }[];
  addEvidence: (ev: Evidence) => void;
  getChild: (id: string) => Child | undefined;
  setSchedule: (sched: PlannerContextType['schedule']) => void;
};

const PlannerContext = React.createContext<PlannerContextType | null>(null);

const sampleChildren: Child[] = [
  { childId: 'c1', name: 'Aarav', dob: '2021-04-10', genome: [{ nodeId: 'NUM-1TO1-5', status:'emerging', pMastery:0.62 }]},
  { childId: 'c2', name: 'Mira', dob: '2021-10-22', genome: [{ nodeId: 'LIT-SCRIBBLE', status:'secured', pMastery:0.91 }]},
  { childId: 'c3', name: 'Zoya', dob: '2022-02-14', genome: [{ nodeId: 'EF-INHIBIT-34', status:'emerging', pMastery:0.44 }]}
];

const sampleActivities: Activity[] = [
  { activityId:'act_tower_01', title:'Build a Tower to 8', levels:[
      { level:'foundational', targets:['FM-STACK-16','NUM-COUNT-30'], adaptations:['bigger blocks','teacher model first']},
      { level:'core', targets:['NUM-1TO1-5'], adaptations:['standard blocks']},
      { level:'stretch', targets:['NUM-COMPARE-SET','EF-INHIBIT-34'], adaptations:['timer challenge','describe plan first']}
    ], requirements:{ space:'floor', materials:['blocks'], duration:10, noise:'medium' } },
  { activityId:'act_soundmatch_01', title:'Sound & Match', levels:[
      { level:'foundational', targets:['COMM-LISTEN','LIT-SCRIBBLE'], adaptations:['fewer cards','model sound clearly']},
      { level:'core', targets:['LIT-LETTER-10','COMM-VOCAB'], adaptations:['mix 6 cards','child says sound']},
      { level:'stretch', targets:['LIT-SOUNDS-5','COMM-SEQUENCE'], adaptations:['initial sound sort','tell mini-story']}
    ], requirements:{ space:'table', materials:['picture cards'], duration:10, noise:'low' } }
];

const defaultSchedule: PlannerContextType['schedule'] = [
  { blockId:'arrival', title:'Arrival', assigned:[] },
  { blockId:'centers', title:'Centers', assigned:[
      { activityId:'act_tower_01', childIds:['c1','c3'], level:'core' },
      { activityId:'act_soundmatch_01', childIds:['c2'], level:'stretch' }
    ]},
  { blockId:'circle', title:'Circle Time', assigned:[] },
  { blockId:'outdoor', title:'Outdoor', assigned:[] },
  { blockId:'closing', title:'Closing', assigned:[] }
];

export function PlannerProvider({children: kids}:{children: React.ReactNode}){
  const [childrenState] = React.useState<Child[]>(sampleChildren);
  const [activitiesState] = React.useState<Activity[]>(sampleActivities);
  const [schedule, setSchedule] = React.useState(defaultSchedule);
  const addEvidence = (ev: Evidence) => {
    console.log('Evidence added', ev);
    // In a real app, push to queue/IndexedDB and trigger genome update.
  };
  const getChild = (id:string)=>childrenState.find(c=>c.childId===id);
  return <PlannerContext.Provider value={{children:childrenState, activities:activitiesState, schedule, setSchedule, addEvidence, getChild}}>{kids}</PlannerContext.Provider>
}

export function usePlanner(){
  const ctx = React.useContext(PlannerContext);
  if(!ctx) throw new Error('PlannerContext missing');
  return ctx;
}
