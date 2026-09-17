import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QueueWorker { id: string; name: string; context: string; checks: string; status: 'pending' | 'verified'; }
interface PlatformStat { value: string; label: string; }

type StatusFilter = 'all' | 'pending' | 'verified';
type ContextFilter = 'all' | 'coordinator' | 'independent' | 'dual';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueWorker[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');

  useEffect(() => {
    const userId = localStorage.getItem('helphome_user_id');
    if (!userId) { navigate('/login', { replace: true }); return; }
    const h = { 'x-user-id': userId };
    Promise.all([
      fetch('/api/verification', { headers: h }).then((r) => r.json()),
      fetch('/api/verification/activity', { headers: h }).then((r) => r.json()),
      fetch('/api/verification/stats', { headers: h }).then((r) => r.json()),
    ])
      .then(([q, a, s]) => {
        if (Array.isArray(q)) setQueue(q);
        if (Array.isArray(a)) setActivity(a);
        if (Array.isArray(s)) setStats(s);
      })
      .catch(() => setError('Cannot reach the server.'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const toggle = async (id: string) => {
    try {
      const userId = localStorage.getItem('helphome_user_id');
      const res = await fetch(`/api/verification/${id}/toggle`, {
        method: 'POST',
        headers: { 'x-user-id': userId || '' },
      });
      const updated = await res.json();
      setQueue((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
    } catch {
      console.error('❌ Failed to toggle verification');
    }
  };

  if (loading) return <div className="card">Loading verification queue...</div>;
  if (error) return <div className="flash error">{error}</div>;

  const matchesContext = (w: QueueWorker) => {
    if (contextFilter === 'all') return true;
    if (contextFilter === 'dual') return w.context.includes('· Dual');
    if (contextFilter === 'coordinator') return w.context.startsWith('Coordinator') && !w.context.includes('· Dual');
    if (contextFilter === 'independent') return w.context.startsWith('Independent') && !w.context.includes('· Dual');
    return true;
  };

  const filtered = queue.filter((w) =>
    (statusFilter === 'all' || w.status === statusFilter) && matchesContext(w)
  );
  const countBy = (fn: (w: QueueWorker) => boolean) => queue.filter(fn).length;

  return (
    <div className="page admin-page">
      <header className="hub-header">
        <h1>Verification Queue</h1>
        <p className="hub-note">Representative pilot data — demo view.</p>
        <p className="hub-sub">
          {queue.length} workers · {countBy((w) => w.status === 'pending')} pending · {countBy((w) => w.status === 'verified')} verified
          {stats[1] && ` · ${stats[1].value} bookings this week`}
          {stats[2] && ` · ${stats[2].value} wellness check-ins`}
        </p>
      </header>

      <div className="hub-switcher">
        {(['all', 'pending', 'verified'] as const).map((f) => (
          <button key={f} className={`hub-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
            {f === 'all' ? `All (${queue.length})` : f === 'pending' ? `Pending (${countBy((w) => w.status === 'pending')})` : `Verified (${countBy((w) => w.status === 'verified')})`}
          </button>
        ))}
      </div>

      <div className="hub-switcher">
        {(['all', 'coordinator', 'independent', 'dual'] as const).map((f) => (
          <button key={f} className={`hub-tab ${contextFilter === f ? 'active' : ''}`} onClick={() => setContextFilter(f)}>
            {f === 'all' ? 'All Contexts' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <section className="card">
        {filtered.length === 0 && <p className="hub-explain">No workers match these filters.</p>}
        {filtered.map((w) => (
          <div className="queue-row" key={w.id}>
            <div>
              <p className="queue-name">{w.name} <span className={`status ${w.status}`}>{w.status}</span></p>
              <p className="queue-context">{w.context}</p>
              <p className="hub-explain">{w.checks}</p>
            </div>
            <button className={w.status === 'verified' ? 'btn secondary' : 'btn'} onClick={() => toggle(w.id)}>
              {w.status === 'verified' ? 'Revoke' : 'Verify'}
            </button>
          </div>
        ))}
      </section>

      <section className="bottom-grid single">
        <article className="card">
          <h3>Recent activity</h3>
          {activity.length === 0
            ? <p className="hub-explain">No recent activity.</p>
            : <ul className="activity-list">{activity.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        </article>
      </section>
    </div>
  );
}