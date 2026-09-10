import { useState } from 'react';

interface RosterWorker {
  id: string;
  name: string;
  role: string;
  capacity: { booked: number; total: number };
  availability: string;
  checkins: number[];
  lastCheckin: string;
}

const ROSTER: RosterWorker[] = [
  { id: 'jane', name: 'Jane Doe', role: 'Support Worker · Personal Care', capacity: { booked: 22, total: 30 }, availability: 'Sat, Sun', checkins: [7, 8, 6, 7], lastCheckin: 'Today' },
  { id: 'sarah', name: 'Sarah Lee', role: 'Support Worker · Community Access', capacity: { booked: 18, total: 30 }, availability: 'Mon, Wed, Sat', checkins: [8, 7, 8, 8], lastCheckin: 'Yesterday' },
  { id: 'john', name: 'John Smith', role: 'Support Worker · Transport', capacity: { booked: 24, total: 30 }, availability: 'No openings this week', checkins: [5, 4, 6, 5], lastCheckin: '2 days ago' },
];

const statusOf = (checkins: number[]) => {
  const avg = checkins.reduce((a, b) => a + b, 0) / checkins.length;
  if (avg >= 7.5) return { label: 'Thriving', cls: 'wb-thriving' };
  if (avg >= 5.5) return { label: 'Steady', cls: 'wb-steady' };
  return { label: 'At risk — check in', cls: 'wb-atrisk' };
};

export default function CoordinatorHub() {
  const [chat, setChat] = useState<{ [id: string]: boolean }>({});
  const flags = ROSTER.filter((w) => statusOf(w.checkins).cls === 'wb-atrisk').length;

  const schedule = (id: string, name: string) => {
    setChat((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>Coordinator Hub</h1>
        <p className="hub-note">Representative coordinator view — pilot data.</p>
        <p className="hub-sub">{ROSTER.length} assigned workers · {flags} wellbeing flag{flags === 1 ? '' : 's'} this week</p>
      </header>

      <section className="hub-grid">
        {ROSTER.map((w) => {
          const pct = Math.round((w.capacity.booked / w.capacity.total) * 100);
          const st = statusOf(w.checkins);
          return (
            <article className="card hub-card" key={w.id}>
              <div className="worker-head">
                <h3>{w.name}</h3>
                <span className={`wb-badge ${st.cls}`}>{st.label}</span>
              </div>
              <p className="roster-role">{w.role}</p>
              <div className="capacity-row">
                <strong>{w.capacity.booked} of {w.capacity.total} hrs</strong>
                <span className="capacity-pct">{pct}% booked</span>
              </div>
              <div className="capacity-bar">
                <div className={`capacity-fill ${pct >= 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="roster-line"><strong>Availability:</strong> {w.availability}</p>
              <p className="roster-line"><strong>Last check-in:</strong> {w.lastCheckin}</p>
              <p className="hub-explain">Wellbeing status derives from confidential check-ins — coordinators see the status, never the answers.</p>
              {chat[w.id] && <div className="flash success">✓ Welfare chat scheduled — {w.name} notified (demo)</div>}
              <button className="btn secondary" onClick={() => schedule(w.id, w.name)}>Schedule welfare chat</button>
            </article>
          );
        })}
      </section>
    </div>
  );
}