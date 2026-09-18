import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Door = 'client' | 'worker' | 'coordinator' | null;
type MatchFilter = 'all' | '50' | '75';
type Funding = '' | 'private' | 'ndis' | 'hcp';

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
  const [funding, setFunding] = useState<Funding>('');
  const [planManagerName, setPlanManagerName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const [workers, setWorkers] = useState<RegWorker[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [interestFilter, setInterestFilter] = useState<string>('all');

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
    setName(''); setEmail(''); setPassword(''); setConfirm(''); setOrg('');
    setFunding(''); setPlanManagerName('');
    setPicked([]); setError('');
    setResent(false);
    setMatchFilter('all');
    setInterestFilter('all');
  };

  const backToDoors = () => { setDoor(null); resetForm(); };

  const submit = async (e: React.FormEvent, requireInterests = false) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (requireInterests && picked.length === 0) { setError('Pick at least one interest so we can match you.'); return; }
    if (door === 'client' && !funding) { setError('Please tell us how your care is funded.'); return; }
    if (door === 'client' && funding === 'ndis' && !planManagerName) { setError('Please tell us who manages your NDIS plan.'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          door, name, email, password,
          orgName: org || undefined,
          interests: picked,
          fundingStream: door === 'client' ? funding : undefined,
          planManagerName: door === 'client' && funding === 'ndis' ? planManagerName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Registration failed. Try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Cannot reach the server. Is the API running?');
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    if (!email) return;
    setResending(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  const ranked = [...workers]
    .map((w) => ({ ...w, pct: matchPct(picked, w) }))
    .sort((a, b) => b.pct - a.pct);

  // ---- Client success screen ----
  if (done && door === 'client') {
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
        <h1>Almost there, {name || 'friend'}!</h1>
        <p className="lead">
          We sent a verification link to <strong>{email || 'your email'}</strong>.
          Click it to activate your account, then log in.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Can't find it? Check your Spam or Promotions folder.
        </p>

        <button
          className="btn btn-block secondary"
          style={{ marginBottom: '1rem' }}
          disabled={resending || resent}
          onClick={resendVerification}
        >
          {resending ? 'Sending…' : resent ? '✓ Verification email sent' : 'Resend verification email'}
        </button>

        {loading ? (
          <p className="hub-explain" style={{ textAlign: 'center' }}>Loading preview…</p>
        ) : (
          <>
            <p className="hub-note" style={{ textAlign: 'center', marginTop: '2rem' }}>
              In the meantime, here's a preview of the kind of workers you'll be matched with:
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
              {filtered.map((w) => (
                <article key={w.id} className="card worker-card">
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
                </article>
              ))}
            </section>
          </>
        )}

        <button className="btn btn-block" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/login')}>
          Go to login
        </button>
        <p className="hub-explain" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Preview uses representative worker data. Log in after verifying to book.
        </p>
      </div>
    );
  }

  // ---- Worker success screen ----
  if (done && door === 'worker') {
    return (
      <div className="register-page">
        <h1>Almost there, {name || 'friend'}!</h1>
        <p className="lead">
          We sent a verification link to <strong>{email || 'your email'}</strong>.
          Click it to activate your account, then log in.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Can't find it? Check your Spam or Promotions folder.
        </p>

        <button
          className="btn btn-block secondary"
          style={{ marginBottom: '2rem' }}
          disabled={resending || resent}
          onClick={resendVerification}
        >
          {resending ? 'Sending…' : resent ? '✓ Verification email sent' : 'Resend verification email'}
        </button>

        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1rem' }}>
          Here's our promise to you — the deal, before anything else:
        </p>
        <ul className="promise-list">
          <li><strong>Your rate is your rate</strong> — 0% platform fees, forever.</li>
          <li><strong>We cap you at 85%</strong> — overbooked workers burn out; we won't let that happen to you.</li>
          <li><strong>Decline without penalty</strong> — never affects your rating. No penalty, ever.</li>
        </ul>

        <button className="btn btn-block" onClick={() => navigate('/login')}>Go to login</button>
      </div>
    );
  }

  // ---- Coordinator success screen ----
  if (done && door === 'coordinator') {
    return (
      <div className="register-page">
        <h1>Thank you, {name || 'there'}!</h1>
        <p className="lead">
          We've noted <strong>{org || 'your organisation'}</strong>'s interest.
          Pilot coordinators are invited personally — we'll be in touch shortly via email.
        </p>
        <p className="hub-note" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Bring your clients — we supply verified, wellness-checked workers. You keep the relationship.
        </p>
        <button className="btn btn-block" onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

  // ---- Client form ----
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
            <label>How is your care funded?</label>
            <select value={funding} onChange={(e) => setFunding(e.target.value as Funding)} required>
              <option value="" disabled>Select…</option>
              <option value="private">Self-funded (private)</option>
              <option value="ndis">NDIS</option>
              <option value="hcp">Aged Care (HCP)</option>
            </select>
          </div>

          {funding === 'ndis' && (
            <div>
              <label>Who manages your NDIS plan?</label>
              <select value={planManagerName} onChange={(e) => setPlanManagerName(e.target.value)} required>
                <option value="" disabled>Select…</option>
                <option value="Self-managed">Self-managed</option>
                <option value="Plan-managed">Plan-managed</option>
                <option value="NDIA-managed">NDIA-managed</option>
                <option value="PlanCare">PlanCare</option>
                <option value="Australian Unity">Australian Unity</option>
                <option value="Trilogy Care">Trilogy Care</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

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

  // ---- Worker form ----
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

  // ---- Coordinator form ----
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