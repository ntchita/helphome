import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type CheckType = 'load' | 'supported' | 'balance';
type Context = 'independent' | 'coordinator';

interface CheckinEntry { day: string; score: number; }

interface MarketplaceRequest {
  id: string;
  client: string;
  service: string;
  when: string;
  matchedOn: string;
  matchPct: number;
  status: string;
}
interface MarketplaceContext {
  profileId: string;
  capacity: { booked: number; total: number };
  request: MarketplaceRequest | null;
}
interface RosterShift {
  id: string;
  client: string;
  service: string;
  when: string;
  status: string;
  location: string;
}
interface RosterContext {
  profileId: string;
  coordinatorName: string;
  coordinatorEmail: string;
  capacity: { booked: number; total: number };
  shifts: RosterShift[];
}
interface HubResponse {
  workerId: string;
  name: string;
  role: string;
  contexts: Context[];
  marketplace: MarketplaceContext | null;
  roster: RosterContext | null;
}

const CHECK_META: { [k in CheckType]: { question: string; low: string; high: string } } = {
  load: { question: 'How manageable was your caseload this week?', low: 'Overwhelmed', high: 'On top of it' },
  supported: { question: 'How supported did you feel by your coordinator?', low: 'Alone', high: 'Supported' },
  balance: { question: 'How balanced did your work and life feel?', low: 'Drained', high: 'Balanced' },
};

export default function WorkerHome() {
  const navigate = useNavigate();
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Context>('independent');
  const [history, setHistory] = useState<CheckinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [checkType, setCheckType] = useState<CheckType>('load');
  const [score, setScore] = useState(6);
  const [notes, setNotes] = useState('');
  const [recorded, setRecorded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [flagError, setFlagError] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('helphome_user_id');
    if (!userId) { navigate('/login', { replace: true }); return; }

    Promise.all([
      fetch('/api/worker-hub', { headers: { 'x-user-id': userId } }).then(async (r) => {
        if (r.status === 401 || r.status === 404) throw new Error('SESSION_EXPIRED');
        return r.json();
      }),
      fetch('/api/checkins', { headers: { 'x-user-id': userId } }).then((r) => r.json()),
    ])
      .then(([hubData, historyData]) => {
        setHub(hubData);
        setHistory(historyData);
        const ctxs: Context[] = hubData.contexts || [];
        setActiveTab(ctxs.includes('independent') ? 'independent' : 'coordinator');
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
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const meta = CHECK_META[checkType];

  const decide = async (d: 'accept' | 'decline') => {
    if (!hub?.marketplace?.request) return;
    setDeciding(true);
    const userId = localStorage.getItem('helphome_user_id');
    await fetch('/api/worker-hub/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
      body: JSON.stringify({ decision: d, requestId: hub.marketplace.request.id }),
    });
    setDecision(d);
    setDeciding(false);
  };

  const submitCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userId = localStorage.getItem('helphome_user_id');
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ type: checkType, score, notes }),
      });
      const result = await res.json();
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.day === 'Today') return [...prev.slice(0, -1), result.entry];
        return [...prev.slice(-3), result.entry];
      });
      setRecorded(true);
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const flagSupport = async () => {
    setFlagging(true);
    setFlagError('');
    try {
      const userId = localStorage.getItem('helphome_user_id') || '';
      const res = await fetch('/api/worker-hub/flag-support', {
        method: 'POST',
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFlagError(data.error === 'No coordinator assigned' ? 'No coordinator assigned to you yet.' : 'Could not flag. Try again.');
        return;
      }
      setFlagged(true);
    } catch {
      setFlagError('Cannot reach the server.');
    } finally {
      setFlagging(false);
    }
  };

  if (loading) return <div className="card">Loading your hub...</div>;
  if (error || !hub) return <div className="card flash error">{error || 'Hub unavailable'}</div>;

  const contexts: Context[] = hub.contexts || [];
  const isDual = contexts.length > 1;
  const hasRoster = contexts.includes('coordinator');
  const hasMarketplace = contexts.includes('independent');

  const activeCapacity =
    activeTab === 'coordinator'
      ? hub.roster?.capacity
      : hub.marketplace?.capacity;

  const pct = activeCapacity ? Math.round((activeCapacity.booked / activeCapacity.total) * 100) : 0;

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>{activeTab === 'coordinator' ? 'HelpHome Roster' : 'CareWork Marketplace'}</h1>
        <p className="hub-note">Representative worker view — pilot data.</p>
        <p className="hub-sub">{hub.name} · {hub.role}</p>
      </header>

      {isDual && (
        <div className="hub-switcher">
          {hasMarketplace && (
            <button className={`hub-tab ${activeTab === 'independent' ? 'active' : ''}`} onClick={() => setActiveTab('independent')}>
              CareWork Marketplace
            </button>
          )}
          {hasRoster && (
            <button className={`hub-tab ${activeTab === 'coordinator' ? 'active' : ''}`} onClick={() => setActiveTab('coordinator')}>
              HelpHome Roster
            </button>
          )}
        </div>
      )}

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>Your load this week</h3>
          {activeCapacity ? (
            <>
              <div className="capacity-row">
                <strong>{activeCapacity.booked} of {activeCapacity.total} hrs</strong>
                <span className="capacity-pct">{pct}% booked</span>
              </div>
              <div className="capacity-bar">
                <div className={`capacity-fill ${pct >= 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <p className="hub-explain">No data for this context.</p>
          )}
          <p className="hub-explain">We cap bookings at 85%. Overbooked workers burn out; burned-out workers quit; quitting breaks care continuity. Your wellbeing is the product.</p>
        </article>

        {activeTab === 'independent' && hasMarketplace && (
          <article className="card hub-card">
            <h3>Incoming client request</h3>
            {hub.marketplace?.request ? (
              <>
                <p className="request-client"><strong>{hub.marketplace.request.client}</strong> · {hub.marketplace.request.service}</p>
                <p className="request-meta">{hub.marketplace.request.when} · Matched on: {hub.marketplace.request.matchedOn} · {hub.marketplace.request.matchPct}% wellness match</p>
                <div className="request-actions">
                  <button className="btn" onClick={() => decide('accept')} disabled={deciding || decision !== null}>Accept</button>
                  <button className="btn secondary" onClick={() => decide('decline')} disabled={deciding || decision !== null}>Decline</button>
                </div>
                {decision === 'accept' && <div className="flash success">✓ Accepted — {hub.marketplace.request.client} notified (demo)</div>}
                {decision === 'decline' && <div className="flash info">Declined — no penalty, no rating impact (demo)</div>}
                <p className="hub-explain">Declining never affects your rating. No penalty, ever.</p>
              </>
            ) : (
              <p className="hub-explain">No open marketplace requests right now.</p>
            )}
          </article>
        )}

        {activeTab === 'coordinator' && hasRoster && (
          <article className="card hub-card">
            <h3>Shifts assigned by your coordinator</h3>
            {hub.roster ? (
              <>
                <p className="request-meta">Coordinator: {hub.roster.coordinatorName} · {hub.roster.coordinatorEmail}</p>
                {hub.roster.shifts.length === 0 && <p className="hub-explain">No upcoming shifts.</p>}
                {hub.roster.shifts.map((sh) => (
                  <div className="queue-row" key={sh.id}>
                    <div>
                      <p className="queue-name">{sh.client} · {sh.service}</p>
                      <p className="hub-explain">{sh.when} · {sh.location}</p>
                    </div>
                    <span className={`status ${sh.status}`}>{sh.status}</span>
                  </div>
                ))}
                <p className="hub-explain">These shifts come from HelpHome's VisualCare roster. HelpHome handles the client relationship and payroll.</p>
              </>
            ) : (
              <p className="hub-explain">Roster unavailable.</p>
            )}
          </article>
        )}

        <article className="card hub-card">
          <h3>Your wellbeing check-ins</h3>
          <div className="mood-bars">
            {history.map((h, i) => (
              <div className="mood-col" key={i}>
                <div className="mood-bar" style={{ height: `${h.score * 10}%` }} />
                <span>{h.day}</span>
              </div>
            ))}
          </div>
          <form onSubmit={submitCheck} className="checkin-form">
            <select value={checkType} onChange={(e) => setCheckType(e.target.value as CheckType)}>
              <option value="load">Load &amp; Energy</option>
              <option value="supported">Feeling Supported</option>
              <option value="balance">Work–Life Balance</option>
            </select>
            <label>{meta.question} Score (1–10): {score}</label>
            <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(parseInt(e.target.value))} />
            <div className="mood-labels"><span>{meta.low}</span><span>{meta.high}</span></div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want your coordinator to know? (optional)" rows={2} />
            <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Submit check-in'}</button>
          </form>
          {recorded && <div className="flash success">✓ Check-in recorded — confidential. Never affects your ratings, bookings or pay.</div>}
          <p className="hub-explain">Confidential by design: your coordinator sees a status (Thriving / Steady / At risk), never your answers.</p>
          <button
            className="btn btn-block"
            style={{ marginTop: '0.75rem' }}
            onClick={flagSupport}
            disabled={flagging || flagged}
          >
            {flagging ? 'Sending...' : flagged ? '✓ Support requested' : 'Flag I need support'}
          </button>
          {flagged && <div className="flash success">✓ Your coordinator has been notified. Someone will reach out soon.</div>}
          {flagError && <div className="flash error">{flagError}</div>}
        </article>
      </section>
    </div>
  );
}