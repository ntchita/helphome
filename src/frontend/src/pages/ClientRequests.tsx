import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type ReqStatus = 'accepted' | 'pending' | 'declined';

interface ClientRequest {
  id: number | string;
  client: string;
  worker: string;
  service: string;
  when: string;
  matchPct: number;
  status: ReqStatus;
}

export default function ClientRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | ReqStatus>('all');

  useEffect(() => {
    const userId = localStorage.getItem('helphome_user_id');
    if (!userId) { navigate('/login', { replace: true }); return; }

    fetch('/api/requests', { headers: { 'x-user-id': userId } })
      .then(async (r) => {
        if (r.status === 401 || r.status === 404) throw new Error('SESSION_EXPIRED');
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setRequests(data);
      })
      .catch((e) => {
        if (e.message === 'SESSION_EXPIRED') {
          localStorage.removeItem('helphome_logged_in');
          localStorage.removeItem('helphome_role');
          localStorage.removeItem('helphome_user_id');
          localStorage.removeItem('helphome_worker_contexts');
          navigate('/login', { replace: true });
          return;
        }
        setError('Cannot reach the server.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div className="card">Loading client requests...</div>;
  if (error) return <div className="card flash error">{error}</div>;

  const rows = requests.filter((r) => filter === 'all' || r.status === filter);
  const count = (s: ReqStatus) => requests.filter((r) => r.status === s).length;

  return (
    <div className="page admin-page">
      <header className="hub-header">
        <h1>All client requests</h1>
        <p className="hub-note">Representative pilot data — demo view.</p>
        <p className="hub-sub">{requests.length} requests this week · {count('accepted')} accepted · {count('pending')} pending · {count('declined')} declined</p>
      </header>

      <div className="hub-switcher">
        {(['all', 'pending', 'accepted', 'declined'] as const).map((f) => (
          <button key={f} className={`hub-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <section className="card">
        {rows.map((r) => (
          <div className="queue-row" key={r.id}>
            <div>
              <p className="queue-name">{r.client} → {r.worker}</p>
              <p className="hub-explain">{r.service} · {r.when} · {r.matchPct}% wellness match</p>
            </div>
            <span className={`status ${r.status}`}>{r.status}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="hub-explain">No requests with this status.</p>}
      </section>
    </div>
  );
}