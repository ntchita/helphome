import { useState } from 'react';

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

const REQUESTS: ClientRequest[] = [
  { id: 1, client: 'Mark T.', worker: 'Jane Doe', service: 'Personal Care', when: 'Fri 10:00–14:00', matchPct: 85, status: 'accepted' },
  { id: 2, client: 'Priya K.', worker: 'Sarah Lee', service: 'Community Access', when: 'Sat 9:00–13:00', matchPct: 78, status: 'accepted' },
  { id: 3, client: 'Dana W.', worker: 'John Smith', service: 'Transport', when: 'Mon 8:00–12:00', matchPct: 72, status: 'declined' },
  { id: 4, client: 'Alex R.', worker: 'Jane Doe', service: 'Personal Care', when: 'Sun 9:00–12:00', matchPct: 64, status: 'pending' },
  { id: 5, client: 'Mei L.', worker: 'Sarah Lee', service: 'Community Access', when: 'Wed 13:00–16:00', matchPct: 81, status: 'accepted' },
  { id: 6, client: 'Tom B.', worker: 'John Smith', service: 'Transport', when: 'Tue 7:00–10:00', matchPct: 58, status: 'declined' },
];

export default function ClientRequests() {
  const [filter, setFilter] = useState<'all' | ReqStatus>('all');
  const rows = REQUESTS.filter((r) => filter === 'all' || r.status === filter);
  const count = (s: ReqStatus) => REQUESTS.filter((r) => r.status === s).length;

  return (
    <div className="page admin-page">
      <header className="hub-header">
        <h1>All client requests</h1>
        <p className="hub-note">Representative pilot data — demo view.</p>
        <p className="hub-sub">{REQUESTS.length} requests this week · {count('accepted')} accepted · {count('pending')} pending · {count('declined')} declined</p>
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