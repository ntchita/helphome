import { useEffect, useState } from 'react';

type ReqStatus = 'accepted' | 'pending' | 'declined';

interface ClientRequest {
  id: number;
  client: string;
  worker: string;
  service: string;
  when: string;
  matchPct: number;
  status: ReqStatus;
}

export default function ClientRequests() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ReqStatus>('all');

  useEffect(() => {
    fetch('/api/requests')
      .then((r) => r.json())
      .then((data) => setRequests(data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Loading client requests...</div>;

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