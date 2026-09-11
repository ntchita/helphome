import { useEffect, useState } from 'react';

interface RosterWorker {
  id: string;
  name: string;
  role: string;
  capacity: { booked: number; total: number };
  availability: string;
  checkins: number[];
  lastCheckin: string;
}

const statusOf = (checkins: number[]) => {
  const avg = checkins.reduce((a, b) => a + b, 0) / checkins.length;
  if (avg >= 7.5) return { label: 'Thriving', cls: 'wb-thriving' };
  if (avg >= 5.5) return { label: 'Steady', cls: 'wb-steady' };
  return { label: 'At risk — check in', cls: 'wb-atrisk' };
};

export default function ManagerHub() {
  const [roster, setRoster] = useState<RosterWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<{ [id: string]: boolean }>({});
  const [scheduling, setScheduling] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    fetch('/api/roster')
      .then((r) => r.json())
      .then((data) => setRoster(data))
      .finally(() => setLoading(false));
  }, []);

  const schedule = async (id: string) => {
    setScheduling((prev) => ({ ...prev, [id]: true }));
    await fetch(`/api/roster/${id}/welfare-chat`, { method: 'POST' });
    setChat((prev) => ({ ...prev, [id]: true }));
    setScheduling((prev) => ({ ...prev, [id]: false }));
  };

  if (loading) return <div className="card">Loading roster...</div>;

  const flags = roster.filter((w) => statusOf(w.checkins).cls === 'wb-atrisk').length;

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>Manager Hub</h1>
        <p className="hub-note">Representative manager view — pilot data.</p>
        <p className="hub-sub">{roster.length} assigned workers · {flags} wellbeing flag{flags === 1 ? '' : 's'} this week</p>
      </header>

      <section className="hub-grid">
        {roster.map((w) => {
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
              <p className="hub-explain">Wellbeing status derives from confidential check-ins — managers see the status, never the answers.</p>
              {chat[w.id] && <div className="flash success">✓ Welfare chat scheduled — {w.name} notified (demo)</div>}
              <button className="btn secondary" onClick={() => schedule(w.id)} disabled={scheduling[w.id]}>
                {scheduling[w.id] ? 'Scheduling...' : 'Schedule welfare chat'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}