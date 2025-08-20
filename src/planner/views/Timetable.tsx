import React from 'react';
import { usePlanner } from '../state/PlannerStore';

export default function TimetableView() {
  const { timetable } = usePlanner() as any;
  const [ageId, setAgeId] = React.useState<string>('toddlers');

  if (!timetable) return <div style={{ padding: 16 }}>Loading timetable…</div>;

  const age = timetable.ageGroups.find((a: any) => a.id === ageId) || timetable.ageGroups[0];
  const days = timetable.days;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Weekly Timetable</h3>
        <select value={age.id} onChange={(e) => setAgeId(e.target.value)}>
          {timetable.ageGroups.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Time</th>
              {days.map((d: string) => (
                <th key={d} style={th}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {age.slots.map((s: any, r: number) => (
              <tr key={r}>
                <td style={tdStrong}>
                  {s.time}
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{s.type}</div>
                </td>
                {days.map((d: string) => (
                  <td key={d} style={td}>
                    {s.desc}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  border: '1px solid #ececec',
  padding: '8px',
  background: '#fafafa',
  textAlign: 'left' as const,
};
const td = {
  border: '1px solid #ececec',
  padding: '8px',
  verticalAlign: 'top' as const,
  background: '#fff',
};
const tdStrong = { ...td, fontWeight: 600 };