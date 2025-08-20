import React from 'react';
import { PlannerProvider } from './state/PlannerStore';
import Today from './views/Today';
import { Plan } from './views/Plan';
import TimetableView from './views/Timetable';
import { Review } from './views/Review';
import ContextualisedToday from './views/ContextualisedToday';

export default function PlannerApp() {
  const [tab, setTab] = React.useState<'today' | 'context' | 'plan' | 'timetable' | 'review'>('today');

  return (
    <PlannerProvider>
      <div style={{ padding: 12 }}>
        <header style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Planner</h2>
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <TabBtn label="Today" on={() => setTab('today')} active={tab === 'today'} />
            <TabBtn label="Contextualised Today" on={() => setTab('context')} active={tab === 'context'} />
            <TabBtn label="Plan (Week)" on={() => setTab('plan')} active={tab === 'plan'} />
            <TabBtn label="Timetable" on={() => setTab('timetable')} active={tab === 'timetable'} />
            <TabBtn label="Review" on={() => setTab('review')} active={tab === 'review'} />
          </nav>
        </header>

        <main>
          {tab === 'today' && <Today />}
          {tab === 'context' && <ContextualisedToday />}
          {tab === 'plan' && <Plan />}
          {tab === 'timetable' && <TimetableView />}
          {tab === 'review' && <Review />}
        </main>
      </div>
    </PlannerProvider>
  );
}

function TabBtn({ label, on, active }: { label: string; on: () => void; active: boolean }) {
  return (
    <button
      onClick={on}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: active ? '#111827' : '#fff',
        color: active ? '#fff' : '#111827',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
