import { useState } from 'react';

type CheckType = 'load' | 'supported' | 'balance';

const CHECK_META: { [k in CheckType]: { question: string; low: string; high: string } } = {
  load: { question: 'How manageable was your caseload this week?', low: 'Overwhelmed', high: 'On top of it' },
  supported: { question: 'How supported did you feel by your coordinator?', low: 'Alone', high: 'Supported' },
  balance: { question: 'How balanced did your work and life feel?', low: 'Drained', high: 'Balanced' },
};

const ME = {
  name: 'Jane Doe',
  role: 'Support Worker · Personal Care',
  capacity: { booked: 22, total: 30 },
  request: { client: 'Mark T.', service: 'Personal Care', when: 'Fri 10:00–14:00', matchedOn: 'dogs', matchPct: 85 },
};

export default function WorkerHome() {
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const [history, setHistory] = useState([
    { day: 'Mon', score: 6 }, { day: 'Tue', score: 7 }, { day: 'Wed', score: 5 }, { day: 'Thu', score: 7 },
  ]);
  const [checkType, setCheckType] = useState<CheckType>('load');
  const [score, setScore] = useState(6);
  const [notes, setNotes] = useState('');
  const [recorded, setRecorded] = useState(false);

  const pct = Math.round((ME.capacity.booked / ME.capacity.total) * 100);
  const meta = CHECK_META[checkType];

  const submitCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setHistory((prev) => [...prev.slice(-3), { day: 'Today', score }]);
    setRecorded(true);
    setNotes('');
  };

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>My Hub</h1>
        <p className="hub-note">Representative worker view — pilot data.</p>
        <p className="hub-sub">{ME.name} · {ME.role}</p>
      </header>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>Your load this week</h3>
          <div className="capacity-row">
            <strong>{ME.capacity.booked} of {ME.capacity.total} hrs</strong>
            <span className="capacity-pct">{pct}% booked</span>
          </div>
          <div className="capacity-bar">
            <div className={`capacity-fill ${pct >= 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="hub-explain">We cap bookings at 85%. Overbooked workers burn out; burned-out workers quit; quitting breaks care continuity. Your wellbeing is the product.</p>
        </article>

        <article className="card hub-card">
          <h3>Incoming client request</h3>
          <p className="request-client"><strong>{ME.request.client}</strong> · {ME.request.service}</p>
          <p className="request-meta">{ME.request.when} · Matched on: {ME.request.matchedOn} · {ME.request.matchPct}% wellness match</p>
          <div className="request-actions">
            <button className="btn" onClick={() => setDecision('accept')}>Accept</button>
            <button className="btn secondary" onClick={() => setDecision('decline')}>Decline</button>
          </div>
          {decision === 'accept' && <div className="flash success">✓ Accepted — {ME.request.client} notified (demo)</div>}
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want your coordinator to know? (optional)" rows={2} />
            <button type="submit" className="btn btn-block">Submit check-in</button>
          </form>
          {recorded && <div className="flash success">✓ Check-in recorded — confidential. Never affects your ratings, bookings or pay.</div>}
          <p className="hub-explain">Confidential by design: your coordinator sees a status (Thriving / Steady / At risk), never your answers.</p>
          <button className="btn btn-block" style={{ marginTop: '0.75rem' }}>Flag I need support</button>
        </article>
      </section>
    </div>
  );
}