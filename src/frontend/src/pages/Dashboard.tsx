import { useEffect, useState } from 'react';

interface Worker {
  id: number;
  name: string;
  skills: string[];
  interests: string[];
  rate: number;
  bio: string;
  wellnessMatch?: number;
  wellnessMatchScore?: number;
}
interface BookingMessage { text: string; type: 'success' | 'error' | 'info'; }

export default function Dashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<{ [key: number]: 'sending' | 'success' | 'error' | null }>({});
  const [messages, setMessages] = useState<{ [key: number]: BookingMessage | null }>({});

  const clientProfile = {
    interests: ['dogs', 'music', 'outdoors'],
    needs: ['Personal Care', 'Companionship']
  };

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/workers');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        setWorkers(data);
        setError(null);
      } catch (err: any) {
        console.error('❌ Failed to fetch workers:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkers();
  }, []);

  const handleBookNow = async (workerId: number, workerName: string, matchScore?: number) => {
    setBookingStatus(prev => ({ ...prev, [workerId]: 'sending' }));
    setMessages(prev => ({ ...prev, [workerId]: null }));
    try {
      const clientId = localStorage.getItem('userId') || `guest-user-${Date.now()}`;
      if (!localStorage.getItem('userId')) localStorage.setItem('userId', clientId);
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, workerId, serviceType: 'Standard Support', timestamp: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Booking failed');
      const result = await response.json();
      setBookingStatus(prev => ({ ...prev, [workerId]: 'success' }));
      setMessages(prev => ({
        ...prev,
        [workerId]: { text: `✅ Request sent to ${workerName}! (Wellness Match: ${result.matchScore ?? matchScore ?? 0}%)`, type: 'success' }
      }));
    } catch (err: any) {
      console.error('❌ Booking error:', err);
      setBookingStatus(prev => ({ ...prev, [workerId]: 'error' }));
      setMessages(prev => ({ ...prev, [workerId]: { text: 'Failed to send request. Try again.', type: 'error' } }));
    }
  };

  const matchOf = (w: Worker) => w.wellnessMatch ?? w.wellnessMatchScore;

  const getMatchReason = (worker: Worker) => {
    const score = matchOf(worker);
    if (score === undefined || score === 0) return 'Standard availability';
    const commonInterests = worker.interests.filter(i => clientProfile.interests.includes(i));
    if (commonInterests.length > 0) return `Matched on: ${commonInterests.join(', ')}`;
    return 'High skill compatibility';
  };

  if (loading) return <div className="card">Loading support workers...</div>;
  if (error) return <div className="card flash error">Error: {error}</div>;

  return (
    <div className="page">
      <header className="hero">
        <h1>Better Care. Perfect Matches. Zero Agency Delays.</h1>
		<p>Connect directly with verified local workers matched to your goals and interests, not just their availability.</p>
        <div className="hero-stats">
          <div className="stat-chip"><strong>100%</strong><span>Direct Care</span></div>
          <div className="stat-chip"><strong>Instant</strong><span>Confirmation</span></div>
          <div className="stat-chip"><strong>Wellness</strong><span>AI Matching</span></div>
        </div>
      </header>

      <section>
        <h2>Choose Your Plan</h2>
        <div className="plans-grid">
          <article className="plan">
            <h3>Starter</h3>
            <div className="plan-price">Free</div>
            <ul className="plan-features">
              <li>✅ Browse all workers</li>
              <li>✅ Standard Matching</li>
              <li>✅ 0% Platform Fees</li>
              <li className="muted">❌ Priority Support</li>
              <li className="muted">❌ Gold Matches (&gt;80%)</li>
            </ul>
            <button className="btn btn-block">Current Plan</button>
          </article>
          <article className="plan plan-premium">
            <span className="plan-flag">Recommended</span>
            <h3>Premium</h3>
            <div className="plan-price">$19<span>/mo</span></div>
            <ul className="plan-features">
              <li>✅ <strong>Everything in Starter</strong></li>
              <li>✅ <strong>Gold Matches</strong> (80%+ Score)</li>
              <li>✅ Priority 24/7 Support</li>
              <li>✅ Advanced Background Checks</li>
              <li>✅ Cancel Anytime</li>
            </ul>
            <button className="btn btn-block btn-upgrade">Upgrade Now</button>
          </article>
        </div>
      </section>

      <section>
        <h2>Available Support Workers</h2>
        <div className="worker-grid">
          {workers.map((worker) => {
            const status = bookingStatus[worker.id];
            const message = messages[worker.id];
            const score = matchOf(worker);
            return (
              <article key={worker.id} className="card worker-card">
                <div>
                  <div className="worker-head">
                    <h3>{worker.name}</h3>
                    {score !== undefined && (
                      <span className={`match-badge ${score > 50 ? 'high' : 'low'}`}>{score}% Match</span>
                    )}
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
                    onClick={() => handleBookNow(worker.id, worker.name, score)}
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
        {workers.length === 0 && !loading && <div className="card">No workers found.</div>}
      </section>
    </div>
  );
}