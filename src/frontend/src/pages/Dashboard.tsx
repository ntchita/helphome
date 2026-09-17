import { useEffect, useState } from 'react';

interface Worker {
  id: string;
  name: string;
  skills: string[];
  interests: string[];
  rate: number;
  bio: string;
  wellnessMatch?: number;
  wellnessMatchScore?: number;
}

interface ClientProfile {
  id: string;
  interests: string[];
  needs: string[];
}

interface BookingMessage { text: string; type: 'success' | 'error' | 'info'; }

type MatchFilter = 'all' | '50' | '75';

export default function Dashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<{ [key: string]: 'sending' | 'success' | 'error' | null }>({});
  const [messages, setMessages] = useState<{ [key: string]: BookingMessage | null }>({});
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [interestFilter, setInterestFilter] = useState<string>('all');

  useEffect(() => {
    const userId = localStorage.getItem('helphome_user_id');
    Promise.all([
      fetch('/api/workers', { headers: { 'x-user-id': userId || '' } }).then((r) => r.json()),
      fetch('/api/client-profile', { headers: { 'x-user-id': userId || '' } }).then((r) => r.json()),
    ])
      .then(([w, p]) => {
        if (Array.isArray(w)) setWorkers(w);
        if (p && !p.error) setClientProfile(p);
        setError(null);
      })
      .catch((err: any) => {
        console.error('❌ Failed to fetch dashboard data:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const scoreOf = (w: Worker) => w.wellnessMatch ?? w.wellnessMatchScore ?? 0;

  const getMatchReason = (worker: Worker) => {
    const score = scoreOf(worker);
    if (score === 0) return 'Standard availability';
    const commonInterests = worker.interests.filter((i) => clientProfile?.interests.includes(i));
    if (commonInterests.length > 0) return `Matched on: ${commonInterests.join(', ')}`;
    return 'High skill compatibility';
  };

  const handleBookNow = async (worker: Worker) => {
    const score = scoreOf(worker);
    setBookingStatus((prev) => ({ ...prev, [worker.id]: 'sending' }));
    setMessages((prev) => ({ ...prev, [worker.id]: null }));
    try {
      const userId = localStorage.getItem('helphome_user_id') || '';
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ workerId: worker.id, serviceType: 'Standard Support' }),
      });
      if (!response.ok) throw new Error('Booking failed');
      const result = await response.json();
      setBookingStatus((prev) => ({ ...prev, [worker.id]: 'success' }));
      setMessages((prev) => ({
        ...prev,
        [worker.id]: { text: `✅ Request sent to ${worker.name}! (Wellness Match: ${result.matchScore ?? score}%)`, type: 'success' },
      }));
    } catch (err: any) {
      console.error('❌ Booking error:', err);
      setBookingStatus((prev) => ({ ...prev, [worker.id]: 'error' }));
      setMessages((prev) => ({ ...prev, [worker.id]: { text: 'Failed to send request. Try again.', type: 'error' } }));
    }
  };

  if (loading) return <div className="card">Loading support workers...</div>;
  if (error) return <div className="flash error">{error}</div>;

  // ---- Filters ----
  const clientInterests = clientProfile?.interests || [];

  const filteredWorkers = workers.filter((w) => {
    const score = scoreOf(w);
    if (matchFilter === '50' && score < 50) return false;
    if (matchFilter === '75' && score < 75) return false;
    if (interestFilter !== 'all' && !w.interests.includes(interestFilter)) return false;
    return true;
  });

  const matchCount = (min: number) => workers.filter((w) => scoreOf(w) >= min).length;

  return (
    <div className="page">
      <header className="hero">
        <h1>Better Care. Perfect Matches. Zero Agency Delays.</h1>
        <p>Connect directly with verified local workers matched to your goals and interests, not just their availability.</p>
        <div className="hero-stats">
          <div className="stat-chip"><strong>100%</strong><span>Direct Care</span></div>
          <div className="stat-chip"><strong>Instant</strong><span>Confirmation</span></div>
          <div className="stat-chip"><strong>Wellness</strong><span>Match Scoring</span></div>
        </div>
      </header>

      {/* Plans section — hidden for pilot; restore by removing the false && wrapper */}
      {false && (
        <section>
          <h2>Choose Your Plan</h2>
          <div className="plans-grid">
            <article className="plan">
              <h3>Starter</h3>
              <div className="plan-price">Free</div>
            </article>
          </div>
        </section>
      )}

      <section>
        <h2>Available Support Workers <span className="queue-count">{filteredWorkers.length}</span></h2>

        <div className="hub-switcher">
          {([
            { key: 'all', label: 'All Matches' },
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

        {clientInterests.length > 0 && (
          <div className="hub-switcher">
            <button
              className={`hub-tab ${interestFilter === 'all' ? 'active' : ''}`}
              onClick={() => setInterestFilter('all')}
            >
              All Interests
            </button>
            {clientInterests.map((i) => (
              <button
                key={i}
                className={`hub-tab ${interestFilter === i ? 'active' : ''}`}
                onClick={() => setInterestFilter(i)}
              >
                {i.charAt(0).toUpperCase() + i.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="worker-grid">
          {filteredWorkers.map((worker) => {
            const status = bookingStatus[worker.id];
            const message = messages[worker.id];
            const score = scoreOf(worker);
            return (
              <article key={worker.id} className="card worker-card">
                <div>
                  <div className="worker-head">
                    <h3>{worker.name}</h3>
                    <span className={`match-badge ${score > 50 ? 'high' : 'low'}`}>{score}% Match</span>
                  </div>
                  <p className="match-reason">{getMatchReason(worker)}</p>
                  <p className="worker-bio">{worker.bio}</p>
                  <p className="worker-skills"><strong>Skills:</strong> {worker.skills.join(', ')}</p>
                  <div className="worker-rate">${worker.rate}/hr <span className="no-fees">(Direct Rate)</span></div>
                </div>
                <div>
                  {message && <div className={`flash ${message.type}`}>{message.text}</div>}
                  <button
                    className={`btn btn-block ${status === 'success' ? 'btn-success' : ''} ${status === 'error' ? 'btn-danger' : ''}`}
                    onClick={() => handleBookNow(worker)}
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending...' :
                     status === 'success' ? '✓ Request Sent' :
                     status === 'error' ? 'Try Again' : 'Book Now'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {filteredWorkers.length === 0 && <div className="card">No workers match these filters.</div>}
      </section>
    </div>
  );
}