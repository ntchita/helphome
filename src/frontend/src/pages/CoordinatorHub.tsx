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

interface ClientRequest {
  id: number | string;
  client: string;
  worker: string;
  service: string;
  when: string;
  matchPct: number;
  status: 'accepted' | 'pending' | 'declined';
}

type StatusFilter = 'all' | 'thriving' | 'steady' | 'atrisk';

const statusOf = (checkins: number[]) => {
  if (!checkins.length) return { label: 'No data', cls: 'wb-steady', key: 'nodata' as const };
  const avg = checkins.reduce((a, b) => a + b, 0) / checkins.length;
  if (avg >= 7.5) return { label: 'Thriving', cls: 'wb-thriving', key: 'thriving' as const };
  if (avg >= 5.5) return { label: 'Steady', cls: 'wb-steady', key: 'steady' as const };
  return { label: 'At risk — check in', cls: 'wb-atrisk', key: 'atrisk' as const };
};

export default function CoordinatorHub() {
  const [roster, setRoster] = useState<RosterWorker[]>([]);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<{ [id: string]: boolean }>({});
  const [scheduling, setScheduling] = useState<{ [id: string]: boolean }>({});
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const userId = localStorage.getItem('helphome_user_id');
    Promise.all([
      fetch('/api/roster', { headers: { 'x-user-id': userId || '' } }).then((r) => r.json()),
      fetch('/api/requests', { headers: { 'x-user-id': userId || '' } }).then((r) => r.json()),
    ])
      .then(([rosterData, requestsData]) => {
        if (Array.isArray(rosterData)) setRoster(rosterData);
        if (Array.isArray(requestsData)) setRequests(requestsData);
      })
      .finally(() => setLoading(false));
  }, []);

  const schedule = async (id: string) => {
    setScheduling((prev) => ({ ...prev, [id]: true }));
    const userId = localStorage.getItem('helphome_user_id');
    await fetch(`/api/roster/${id}/welfare-chat`, {
      method: 'POST',
      headers: { 'x-user-id': userId || '' },
    });
    setChat((prev) => ({ ...prev, [id]: true }));
    setScheduling((prev) => ({ ...prev, [id]: false }));
  };

  if (loading) return <div className="card">Loading roster...</div>;

  const counts = {
    all: roster.length,
    thriving: roster.filter((w) => statusOf(w.checkins).key === 'thriving').length,
    steady: roster.filter((w) => statusOf(w.checkins).key === 'steady').length,
    atrisk: roster.filter((w) => statusOf(w.checkins).key === 'atrisk').length,
  };

  const filteredRoster = roster.filter((w) =>
    filter === 'all' ? true : statusOf(w.checkins).key === filter
  );

  // Map worker name → status key, so requests can be filtered by the same rule
  const workerStatusByName = new Map(
    roster.map((w) => [w.name, statusOf(w.checkins).key] as const)
  );

  const workerNames = new Set(roster.map((w) => w.name));
  const tenantRequests = requests.filter((r) => workerNames.has(r.worker));
  const myRequests = tenantRequests.filter((r) =>
    filter === 'all' ? true : workerStatusByName.get(r.worker) === filter
  );

  const flags = counts.atrisk;

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>Coordinator Hub</h1>
        <p className="hub-note">Representative coordinator view — pilot data.</p>
        <p className="hub-sub">{roster.length} assigned workers · {flags} wellbeing flag{flags === 1 ? '' : 's'} this week</p>
      </header>

      <div className="hub-switcher">
        {(['all', 'thriving', 'steady', 'atrisk'] as const).map((f) => {
          const labels: Record<StatusFilter, string> = {
            all: 'All',
            thriving: 'Thriving',
            steady: 'Steady',
            atrisk: 'At Risk',
          };
          return (
            <button key={f} className={`hub-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {labels[f]} ({counts[f]})
            </button>
          );
        })}
      </div>

      <section className="hub-grid">
        {filteredRoster.length === 0 && (
          <p className="hub-explain" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
            No workers with this status.
          </p>
        )}
        {filteredRoster.map((w) => {
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
              <button className="btn secondary" onClick={() => schedule(w.id)} disabled={scheduling[w.id]}>
                {scheduling[w.id] ? 'Scheduling...' : 'Schedule welfare chat'}
              </button>
            </article>
          );
        })}
      </section>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h2>Client Requests for Your Workers</h2>
        <p className="hub-explain">
          {filter === 'all'
            ? `${tenantRequests.length} active request${tenantRequests.length === 1 ? '' : 's'} assigned to your team.`
            : `${myRequests.length} request${myRequests.length === 1 ? '' : 's'} for ${filter === 'atrisk' ? 'At Risk' : filter.charAt(0).toUpperCase() + filter.slice(1)} workers.`}
        </p>
        {myRequests.length === 0 ? (
          <p className="hub-explain">No requests match this filter.</p>
        ) : (
          myRequests.map((r) => (
            <div className="queue-row" key={r.id}>
              <div>
                <p className="queue-name">{r.client} → {r.worker}</p>
                <p className="hub-explain">{r.service} · {r.when} · {r.matchPct}% wellness match</p>
              </div>
              <span className={`status ${r.status}`}>{r.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}