import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Door = 'client' | 'worker' | 'coordinator' | null;

interface RegWorker {
  id: number;
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

  useEffect(() => {
    Promise.all([
      fetch('/api/workers').then((r) => r.json()),
      fetch('/api/interests').then((r) => r.json()),
    ])
      .then(([w, i]) => {
        setWorkers(w);
        setInterests(i);
      })
      .catch(() => setError('Cannot reach the server. Is the API running?'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (i: string) =>
    setPicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setConfirm(''); setOrg(''); setPicked([]); setError('');
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

  const ranked = [...workers].map((w) => ({ ...w, pct: matchPct(picked, w) })).sort((a, b) => b.pct - a.pct);

  if (done && door === 'client') {
    if (loading) {
      return (
        <div className="register-page" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2>Finding your perfect matches...</h2>
          <p className="lead">Please wait a moment while we search our verified workers.</p>
        </div>
      );
    }

    return (
      <div className="register-page">
        <h1>Welcome to HelpHome, {name || 'there'}!</h1>
        <p className="lead">We matched you before you finished your coffee. Based on your interests, here are your first support workers:</p>
        <section className="worker-grid">
          {ranked.map((w) => (
            <article className="card worker-card" key={w.id}>
              <div className="worker-head">
                <h3>{w.name}</h3>
                <span className={`match-badge ${w.pct >= 60 ? 'gold' : ''}`}>{w.pct}% Match</span>
              </div>
              <p className="worker-role">{w.role}</p>
              <p className="worker-bio">{w.bio}</p>
            </article>
          ))}
        </section>
        <button className="btn btn-block" onClick={() => navigate('/login')}>Go to login</button>
        <p className="hub-explain">Matches use representative worker data. Real accounts are created during pilot onboarding.</p>
      </div>
    );
  }

  if (done && door === 'worker') {
    return (
      <div className="register-page">
        <h1>Welcome aboard, {name || 'there'}!</h1>
        <p className="lead">Here's your promise — the deal, before we ask for anything else:</p>
        <ul className="promise-list">
          <li><strong>Your rate is your rate</strong> — 0% platform fees, forever.</li>
          <li><strong>We cap you at 85%</strong> — overbooked workers burn out; we won't let that happen to you.</li>
          <li><strong>Decline without penalty</strong> — never affects your rating. No penalty, ever.</li>
        </ul>
        <p className="hub-note">Verification starts now. Workers with valid checks are activated within 24 hours.</p>
        <button className="btn btn-block" onClick={() => navigate('/login')}>Go to login</button>
      </div>
    );
  }

  if (done && door === 'coordinator') {
    return (
      <div className="register-page">
        <h1>Thank you, {name || 'there'}!</h1>
        <p className="lead">We've noted {org || 'your organisation'}'s interest. Pilot coordinators are invited personally — we'll be in touch shortly via email.</p>
        <p className="hub-note">Bring your clients — we supply verified, wellness-checked workers. You keep the relationship.</p>
        <button className="btn btn-block" onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

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
          <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Find my matches'}</button>
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
          <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving...' : 'Start verification'}</button>
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

  return (
    <div className="register-page">
      <h1>Join HelpHome</h1>
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