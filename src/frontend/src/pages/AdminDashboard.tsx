import { useState } from 'react';

interface QueueWorker { id: number; name: string; checks: string; status: 'pending' | 'verified'; }

const INITIAL_QUEUE: QueueWorker[] = [
  { id: 1, name: 'Jane Doe', checks: 'NDIS Worker Screening · Police check · References', status: 'verified' },
  { id: 2, name: 'Sarah Lee', checks: 'NDIS Worker Screening · Police check', status: 'verified' },
  { id: 3, name: 'John Smith', checks: 'NDIS Worker Screening · References', status: 'pending' },
];

const ACTIVITY = [
  'Jane Doe accepted a booking request — Thu 9:00',
  'Sarah Lee submitted a wellness check (4/5) — Wed',
  'New worker application received: John Smith — Mon',
];

export default function AdminDashboard() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);

  const toggle = (id: number) => {
    setQueue(prev => prev.map(w => w.id === id ? { ...w, status: w.status === 'verified' ? 'pending' : 'verified' } : w));
  };

  return (
    <div className="page admin-page">
      <header className="hub-header">
        <h1>Verification Queue</h1>
        <p className="hub-note">Representative pilot data — demo view.</p>
      </header>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>Platform overview</h3>
          <p className="admin-stat"><strong>3</strong> active support workers</p>
          <p className="admin-stat"><strong>2</strong> bookings this week</p>
          <p className="admin-stat"><strong>4</strong> wellness check-ins this week</p>
          <p className="hub-explain">Pilot-scale numbers. Post-pilot this reads from the live database.</p>
        </article>

        <article className="card hub-card">
          <h3>Verification queue</h3>
          {queue.map(w => (
            <div className="queue-row" key={w.id}>
              <div>
                <p className="queue-name">{w.name} <span className={`status ${w.status}`}>{w.status}</span></p>
                <p className="hub-explain">{w.checks}</p>
              </div>
              <button className={w.status === 'verified' ? 'btn secondary' : 'btn'} onClick={() => toggle(w.id)}>
                {w.status === 'verified' ? 'Revoke' : 'Verify'}
              </button>
            </div>
          ))}
        </article>

        <article className="card hub-card">
          <h3>Recent activity</h3>
          <ul className="activity-list">
            {ACTIVITY.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </article>
      </section>
    </div>
  );
}