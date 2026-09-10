import { useState } from 'react';

interface HubWorker {
  id: string;
  name: string;
  role: string;
  capacity: { booked: number; total: number };
  request: { client: string; service: string; when: string; matchedOn: string; matchPct: number };
  mood: number[];
}

const WORKERS: HubWorker[] = [
  {
    id: 'jane',
    name: 'Jane Doe',
    role: 'Support Worker · Personal Care',
    capacity: { booked: 22, total: 30 },
    request: { client: 'Mark T.', service: 'Personal Care', when: 'Fri 10:00–14:00', matchedOn: 'dogs', matchPct: 85 },
    mood: [60, 80, 45, 70],
  },
  {
    id: 'sarah',
    name: 'Sarah Lee',
    role: 'Support Worker · Community Access',
    capacity: { booked: 18, total: 30 },
    request: { client: 'Priya K.', service: 'Community Access', when: 'Sat 9:00–13:00', matchedOn: 'music', matchPct: 78 },
    mood: [70, 65, 75, 80],
  },
  {
    id: 'john',
    name: 'John Smith',
    role: 'Support Worker · Transport',
    capacity: { booked: 24, total: 30 },
    request: { client: 'Dana W.', service: 'Transport', when: 'Mon 8:00–12:00', matchedOn: 'fitness', matchPct: 72 },
    mood: [50, 55, 60, 65],
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu'];

export default function WorkerHub() {
  const [workerId, setWorkerId] = useState('jane');
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const w = WORKERS.find((x) => x.id === workerId)!;
  const pct = Math.round((w.capacity.booked / w.capacity.total) * 100);

  const switchTo = (id: string) => {
    setWorkerId(id);
    setDecision(null);
  };

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>Worker Hub</h1>
        <p className="hub-note">Representative worker view.</p>
      </header>

      <div className="hub-switcher">
        {WORKERS.map((x) => (
          <button
            key={x.id}
            className={`hub-tab ${x.id === workerId ? 'active' : ''}`}
            onClick={() => switchTo(x.id)}
          >
            {x.name}
          </button>
        ))}
      </div>

      <p className="hub-sub" style={{ textAlign: 'center' }}>{w.role}</p>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>This week's capacity</h3>
          <div className="capacity-row">
            <strong>{w.capacity.booked} of {w.capacity.total} hrs</strong>
            <span className="capacity-pct">{pct}% booked</span>
          </div>
          <div className="capacity-bar">
            <div className={`capacity-fill ${pct >= 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="hub-explain">
            We cap bookings at 85%. Overbooked workers burn out; burned-out workers quit;
            quitting breaks care continuity. Your wellbeing is the product.
          </p>
        </article>

        <article className="card hub-card">
          <h3>Incoming request</h3>
          <p className="request-client"><strong>{w.request.client}</strong> · {w.request.service}</p>
          <p className="request-meta">{w.request.when} · Matched on: {w.request.matchedOn} · {w.request.matchPct}% wellness match</p>
          <div className="request-actions">
            <button className="btn" onClick={() => setDecision('accept')}>Accept</button>
            <button className="btn secondary" onClick={() => setDecision('decline')}>Decline</button>
          </div>
          {decision === 'accept' && <div className="flash success">✓ Accepted — {w.request.client} notified (demo)</div>}
          {decision === 'decline' && <div className="flash info">Declined — no penalty, no rating impact (demo)</div>}
          <p className="hub-explain">Declining never affects your rating. No penalty, ever.</p>
        </article>

        <article className="card hub-card">
          <h3>Your wellbeing trend</h3>
          <div className="mood-bars">
            {w.mood.map((m, i) => (
              <div className="mood-col" key={i}>
                <div className="mood-bar" style={{ height: `${m}%` }} />
                <span>{DAYS[i]}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-block">Flag I need support</button>
        </article>
      </section>
    </div>
  );
}