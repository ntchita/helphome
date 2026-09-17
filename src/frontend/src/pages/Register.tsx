import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Door = 'client' | 'worker' | 'coordinator' | null;
type MatchFilter = 'all' | '50' | '75';

interface RegWorker {
  id: string;
  name: string;
  role: string;
  bio: string;
  interests: string[];
}

const matchPct = (picked: string[], worker: RegWorker) => {
  if (!picked.length) return 0;
  const overlap = picked.filter((i) => worker.interests.includes(i.toLowerCase())).length;
  return Math.round((overlap / picked.length) * 100);
};

export default function Register() {
  const navigate = useNavigate();
  const [door, setDoor] = useState<Door>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [org, setOrg] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [workers, setWorkers] = useState<RegWorker[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [interestFilter, setInterestFilter] = useState<string>('all');
  const [selectedWorker, setSelectedWorker] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetch('/api/workers').then((r) => r.json()),
      fetch('/api/interests').then((r) => r.json()),
    ])
      .then(([w, i]) => {
        if (Array.isArray(w)) setWorkers(w);
        if (Array.isArray(i)) setInterests(i);
      })
      .catch(() => setError('Cannot reach the server. Is the API running?'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (i: string) =>
    setPicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setConfirm(''); setOrg(''); setPicked([]); setError('');
    setSelectedWorker('');
    setMatchFilter('all');
    setInterestFilter('all');
  };

  const backToDoors = () => { setDoor(null); resetForm(); };

  const submit = async (e: React.FormEvent, requireInterests = false) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (requireInterests && picked.length === 0) { setError('Pick at least one interest so we can match you.'); return; }
    setError('');
    setSaving(true);
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ door, name, email, orgName: org || undefined, interests: picked }),
      });
      setDone(true);
    } catch {
      setError('Cannot reach the server. Is the API running?');
    } finally {
      setSaving(false);
    }
  };

  const ranked = [...workers]
    .map((w) => ({ ...w, pct: matchPct(picked, w) }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Client success screen ----
  if (done && door === 'client') {
    if (loading) {
      return (
        <div className="register-page" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2>Finding your perfect matches...</h2>
          <p className="lead">Please wait a moment while we search our verified workers.</p>
        </div>
      );
    }

    // Only workers who share at least one picked interest are eligible.
    const eligible = ranked.filter((w) => w.pct > 0);

    const filtered = eligible.filter((w) => {
      if (matchFilter === '50' && w.pct < 50) return false;
      if (matchFilter === '75' && w.pct < 75) return false;
      if (interestFilter !== 'all' && !w.interests.includes(interestFilter.toLowerCase())) return false;
      return true;
    });

    const matchCount = (min: number) => eligible.filter((w) => w.pct >= min).length;

    return (
      <div className="register-page">
        <h1>Thanks, {name || 'there'}!</h1>
        <p className="lead">
          Your application is in. We'll email <strong>{email || 'you'}</strong> once your account is verified — usually within 24 hours.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          In the meantime, pick the workers you'd like to be matched with:
        </p>

        <div className="hub-switcher">
          {([
            { key: 'all', label: `All (${eligible.length})` },
            { key: '50', label: `50%+ (${matchCount(50)})` },
            { key: '75', label: `75%+ (${matchCount(75)})` },
          ] as const).map((f) => (
            <button
              key={f.key}
              className={`hub-tab ${matchFilter === f.key ? 'active' : ''}`}
              onClick={() => setMatchFilter(f.key as MatchFilter)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {picked.length > 0 && (
          <div className="hub-switcher">
            <button
              className={`hub-tab ${interestFilter === 'all' ? 'active' : ''}`}
              onClick={() => setInterestFilter('all')}
            >
              All
            </button>
            {picked.map((i) => (
              <button
                key={i}
                className={`hub-tab ${interestFilter === i ? 'active' : ''}`}
                onClick={() => setInterestFilter(i)}
              >
                {i}
              </button>
            ))}
          </div>
        )}

        <section className="worker-grid">
          {filtered.length === 0 && (
            <p className="hub-explain" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
              No workers match these filters.
            </p>
          )}
          {filtered.map((w) => {
            const selected = selectedWorker === w.id;
            return (
              <article
                key={w.id}
                className="card worker-card"
                style={{ cursor: 'pointer', outline: selected ? '2px solid var(--hh-blue)' : 'none' }}
                onClick={() => setSelectedWorker(selected ? '' : w.id)}
              >
                <div>
                  <div className="worker-head">
                    <h3>{w.name}</h3>
                    <span className={`match-badge ${w.pct >= 60 ? 'high' : 'low'}`}>{w.pct}% Match</span>
                  </div>
                  <p className="worker-role">{w.role}</p>
                  <p className="worker-bio">{w.bio}</p>
                  <p className="worker-skills">
                    <strong>Interests:</strong>{' '}
                    {w.interests.length > 0 ? w.interests.join(', ') : '—'}
                  </p>
                </div>
                <button
                  className={`btn btn-block ${selected ? 'btn-success' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWorker(selected ? '' : w.id);
                  }}
                >
                  {selected ? '✓ Selected' : 'Select this worker'}
                </button>
              </article>
            );
          })}
        </section>

        {selectedWorker && (
          <div className="flash success" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            Noted — we'll match you with {ranked.find((w) => w.id === selectedWorker)?.name} once your account is verified.
          </div>
        )}

        <button className="btn btn-block" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
          Back to home
        </button>
        <p className="hub-explain" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Preview uses representative worker data. Real matches are shown once your account is created during pilot onboarding.
        </p>
      </div>
    );
  }

  // ---- Worker / Coordinator success ----
  if (done && door === 'worker') {
    return (
      <div className="register-page">
        <h1>Thanks, {name || 'there'}!</h1>
        <p className="lead">
          Your application is in. We'll email <strong>{email || 'you'}</strong> once verification is complete — usually within 24 hours.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Here's our promise to you — the deal, before anything else:
        </p>
        <ul className="promise-list">
          <li><strong>Your rate is your rate</strong> — 0% platform fees, forever.</li>
          <li><strong>We cap you at 85%</strong> — overbooked workers burn out; we won't let that happen to you.</li>
          <li><strong>Decline without penalty</strong> — never affects your rating. No penalty, ever.</li>
        </ul>
        <button className="btn btn-block" onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

  if (done && door === 'coordinator') {
    return (
      <div className="register-page">
        <h1>Thank you, {name || 'there'}!</h1>
        <p className="lead">
          We've noted <strong>{org || 'your organisation'}</strong>'s interest. Pilot coordinators are invited personally — we'll be in touch shortly via email.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Bring your clients — we supply verified, wellness-checked workers. You keep the relationship.
        </p>
        <button className="btn btn-block" onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

  // ---- Forms (unchanged from your last version) ----
  if (door === 'client') {
    return (
      <div className="register-page">
        <button className="back-link" onClick={backToDoors}>← Back to doors</button>
        <h1>I need support</h1>
        <p className="lead">Tell us what matters to you — we'll match you to workers who share it.</p>
        {error && <div className="flash error">{error}</div>}
        <form onSubmit={(e) => submit(e, true)} className="auth-form">
          <div><label>Your name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></div>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <div><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required /></div>
          <div><label>Confirm password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" required /></div>
          <div>
            <label>What matters to you? (pick any)</label>
            {loading ? (
              <p className="hub-explain">Loading interests…</p>
            ) : (
              <div className="interest-chips">
                {interests.map((i) => (
                  <button type="button" key={i} className={`chip ${picked.includes(i) ? 'active' : ''}`} onClick={() => toggle(i)}>{i}</button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Submit application'}</button>
        </form>
      </div>
    );
  }

  if (door === 'worker') {
    return (
      <div className="register-page">
        <button className="back-link" onClick={backToDoors}>← Back to doors</button>
        <h1>I want to provide support</h1>
        <p className="lead">The deal first — then the checks.</p>
        {error && <div className="flash error">{error}</div>}
        <ul className="promise-list compact">
          <li><strong>0% platform fees</strong> — your rate is your rate.</li>
          <li><strong>85% capacity cap</strong> — we never overbook you.</li>
          <li><strong>Decline without penalty</strong> — ever.</li>
        </ul>
        <form onSubmit={(e) => submit(e)} className="auth-form">
          <div><label>Your name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></div>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <div><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required /></div>
          <div><label>Confirm password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" required /></div>
          <div><label>Working rights</label>
            <select required defaultValue=""><option value="" disabled>Select…</option><option>Australian citizen / PR</option><option>Valid working visa</option></select>
          </div>
          <div><label>NDIS Worker Screening Check</label>
            <select required defaultValue=""><option value="" disabled>Select…</option><option>Already hold one</option><option>Willing to obtain one</option></select>
          </div>
          <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Submit application'}</button>
        </form>
      </div>
    );
  }

  if (door === 'coordinator') {
    return (
      <div className="register-page">
        <button className="back-link" onClick={backToDoors}>← Back to doors</button>
        <h1>I coordinate care</h1>
        <p className="lead">Bring your clients — we supply verified, wellness-checked workers. You keep the relationship.</p>
        {error && <div className="flash error">{error}</div>}
        <form onSubmit={(e) => submit(e)} className="auth-form">
          <div><label>Your name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></div>
          <div><label>Organisation</label><input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation name" required /></div>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.com" required /></div>
          <div><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required /></div>
          <div><label>Confirm password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" required /></div>
          <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Join the coordinator waitlist'}</button>
        </form>
        <p className="hub-explain">Five fields. Hireup asks providers twelve to say maybe.</p>
      </div>
    );
  }

  // ---- Door selection ----
  return (
    <div className="register-page">
      <h1>Join CareWork</h1>
      <p className="lead">Better care, perfect matches, zero agency delays. Choose your door:</p>
      <section className="door-grid">
        <button className="door-card" onClick={() => { setDoor('client'); resetForm(); }}>
          <span className="door-icon">🤝</span>
          <h3>I need support</h3>
          <p>Connect directly with verified local workers matched to your goals and interests.</p>
        </button>
        <button className="door-card" onClick={() => { setDoor('worker'); resetForm(); }}>
          <span className="door-icon">💼</span>
          <h3>I want to provide support</h3>
          <p>Keep 100% of your rate. Capped hours. Decline without penalty. Your wellbeing is the product.</p>
        </button>
        <button className="door-card" onClick={() => { setDoor('coordinator'); resetForm(); }}>
          <span className="door-icon">🏢</span>
          <h3>I coordinate care</h3>
          <p>Plan managers &amp; providers: place your clients with our verified workers. You keep the relationship.</p>
        </button>
      </section>
      <p className="register-footer">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}