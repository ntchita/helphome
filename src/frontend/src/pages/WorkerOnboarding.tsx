import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SKILLS = [
  'Personal Care',
  'Community Access',
  'Transport',
  'Companionship',
  'Meal Preparation',
  'Medication Management',
  'Social Support',
  'Art Programs',
  'Fitness Coaching',
];

export default function WorkerOnboarding() {
  const navigate = useNavigate();
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('40');
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([]);
  const [consentToDisplay, setConsentToDisplay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/interests')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllInterests(data); })
      .catch(() => {});
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (bio.trim().length < 20) { setError('Bio must be at least 20 characters.'); return; }
    const rate = Number(hourlyRate);
    if (!rate || rate < 20 || rate > 200) { setError('Hourly rate must be between $20 and $200.'); return; }
    if (skills.length === 0) { setError('Pick at least one skill.'); return; }
    if (interests.length === 0) { setError('Pick at least one interest.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/worker-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, hourlyRate: rate, skills, interests, consentToDisplay }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || 'Onboarding failed.'); return; }
      navigate('/my-hub');
    } catch {
      setError('Cannot reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="register-page">
      <h1>Complete your worker profile</h1>
      <p className="lead">
        Tell clients who you are and how you like to work. You can update this any time.
      </p>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label>About you</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio — background, experience, what you enjoy about support work (min 20 characters)."
            rows={4}
            required
          />
        </div>

        <div>
          <label>Hourly rate (AUD)</label>
          <input
            type="number"
            min={20}
            max={200}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="40"
            required
          />
        </div>

        <div>
          <label>Skills (pick any)</label>
          <div className="interest-chips">
            {SKILLS.map((s) => (
              <button
                type="button"
                key={s}
                className={`chip ${skills.includes(s) ? 'active' : ''}`}
                onClick={() => toggle(skills, setSkills, s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>Interests (used for matching)</label>
          {allInterests.length === 0 ? (
            <p className="hub-explain">Loading interests…</p>
          ) : (
            <div className="interest-chips">
              {allInterests.map((i) => (
                <button
                  type="button"
                  key={i}
                  className={`chip ${interests.includes(i.toLowerCase()) ? 'active' : ''}`}
                  onClick={() => toggle(interests, setInterests, i.toLowerCase())}
                >
                  {i}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={consentToDisplay}
              onChange={(e) => setConsentToDisplay(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Show my profile in the marketplace
          </label>
          <p className="hub-explain" style={{ marginTop: '0.4rem' }}>
            You can turn this off at any time. Clients can only see your profile when this is on.
          </p>
        </div>

        <button type="submit" className="btn btn-block" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}