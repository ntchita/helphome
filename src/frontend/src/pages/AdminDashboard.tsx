import { useEffect, useState } from 'react';

interface QueueWorker { id: number; name: string; checks: string; status: 'pending' | 'verified'; }
interface PlatformStat { value: string; label: string; }

export default function AdminDashboard() {
  const [queue, setQueue] = useState<QueueWorker[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/verification').then((r) => r.json()),
      fetch('/api/verification/activity').then((r) => r.json()),
      fetch('/api/verification/stats').then((r) => r.json()),
    ])
      .then(([q, a, s]) => {
        setQueue(q);
        setActivity(a);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id: number) => {
    try {
      const res = await fetch(`/api/verification/${id}/toggle`, { method: 'POST' });
      const updated = await res.json();
      setQueue((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch {
      console.error('❌ Failed to toggle verification');
    }
  };

  if (loading) return <div className="card">Loading verification queue...</div>;

  return (
    <div className="page admin-page">
      <header className="hub-header">
        <h1>Verification Queue</h1>
        <p className="hub-note">Representative pilot data — demo view.</p>
      </header>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>Platform overview</h3>
          {stats.map((s, i) => (
            <p className="admin-stat" key={i}><strong>{s.value}</strong> {s.label}</p>
          ))}
          <p className="hub-explain">Pilot-scale numbers. Post-pilot this reads from the live database.</p>
        </article>

        <article className="card hub-card">
          <h3>Verification queue</h3>
          {queue.map((w) => (
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
            {activity.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </article>
      </section>
    </div>
  );
}