import { useEffect, useState } from 'react';

type CheckType = 'load' | 'supported' | 'balance';

interface CheckinEntry { day: string; score: number; }
interface WorkerHub {
  workerId: string;
  name: string;
  role: string;
  capacity: { booked: number; total: number };
  request: { id: string; client: string; service: string; when: string; matchedOn: string; matchPct: number };
}

const CHECK_META: { [k in CheckType]: { question: string; low: string; high: string } } = {
  load: { question: 'How manageable was your caseload this week?', low: 'Overwhelmed', high: 'On top of it' },
  supported: { question: 'How supported did you feel by your manager?', low: 'Alone', high: 'Supported' },
  balance: { question: 'How balanced did your work and life feel?', low: 'Drained', high: 'Balanced' },
};

export default function WorkerHome() {
  const [hub, setHub] = useState<WorkerHub | null>(null);
  const [history, setHistory] = useState<CheckinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [checkType, setCheckType] = useState<CheckType>('load');
  const [score, setScore] = useState(6);
  const [notes, setNotes] = useState('');
  const [recorded, setRecorded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/worker-hub').then((r) => r.json()),
      fetch('/api/checkins').then((r) => r.json()),
    ])
      .then(([hubData, historyData]) => {
        setHub(hubData);
        setHistory(historyData);
      })
      .finally(() => setLoading(false));
  }, []);

  const meta = CHECK_META[checkType];

  const decide = async (d: 'accept' | 'decline') => {
    setDeciding(true);
    await fetch('/api/worker-hub/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: d }),
    });
    setDecision(d);
    setDeciding(false);
  };

  const submitCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  if (loading || !hub) return <div className="card">Loading your hub...</div>;

  const pct = Math.round((hub.capacity.booked / hub.capacity.total) * 100);

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>My Hub</h1>
        <p className="hub-note">Representative worker view — pilot data.</p>
        <p className="hub-sub">{hub.name} · {hub.role}</p>
      </header>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>Your load this week</h3>
          <div className="capacity-row">
            <strong>{hub.capacity.booked} of {hub.capacity.total} hrs</strong>
            <span className="capacity-pct">{pct}% booked</span>
          </div>
          <div className="capacity-bar">
            <div className={`capacity-fill ${pct >= 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="hub-explain">We cap bookings at 85%. Overbooked workers burn out; burned-out workers quit; quitting breaks care continuity. Your wellbeing is the product.</p>
        </article>

        <article className="card hub-card">
          <h3>Incoming client request</h3>
          <p className="request-client"><strong>{hub.request.client}</strong> · {hub.request.service}</p>
          <p className="request-meta">{hub.request.when} · Matched on: {hub.request.matchedOn} · {hub.request.matchPct}% wellness match</p>
          <div className="request-actions">
            <button className="btn" onClick={() => decide('accept')} disabled={deciding || decision !== null}>Accept</button>
            <button className="btn secondary" onClick={() => decide('decline')} disabled={deciding || decision !== null}>Decline</button>
          </div>
          {decision === 'accept' && <div className="flash success">✓ Accepted — {hub.request.client} notified (demo)</div>}
          {decision === 'decline' && <div className="flash info">Declined — no penalty, no rating impact (demo)</div>}
          <p className="hub-explain">Declining never affects your rating. No penalty, ever.</p>
        </article>

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
              <option value="load">Load & Energy</option>
              <option value="supported">Feeling Supported</option>
              <option value="balance">Work–Life Balance</option>
            </select>
            <label>{meta.question} Score (1–10): {score}</label>
            <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(parseInt(e.target.value))} />
            <div className="mood-labels"><span>{meta.low}</span><span>{meta.high}</span></div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want your manager to know? (optional)" rows={2} />
            <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Submit check-in'}</button>
          </form>
          {recorded && <div className="flash success">✓ Check-in recorded — confidential. Never affects your ratings, bookings or pay.</div>}
          <p className="hub-explain">Confidential by design: your manager sees a status (Thriving / Steady / At risk), never your answers.</p>
          <button className="btn btn-block" style={{ marginTop: '0.75rem' }}>Flag I need support</button>
        </article>
      </section>
    </div>
  );
}