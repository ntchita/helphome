import { useEffect, useState } from 'react';

// Define Types
interface Worker {
  id: number;
  name: string;
  skills: string[];
  interests: string[];
  rate: number;
  bio: string;
  wellnessMatch?: number;
}

interface BookingMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}

export default function Dashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<{ [key: number]: 'sending' | 'success' | 'error' | null }>({});
  const [messages, setMessages] = useState<{ [key: number]: BookingMessage | null }>({});

  // Mock Client Profile for Matching Logic
  const clientProfile = {
    interests: ["dogs", "music", "outdoors"],
    needs: ["Personal Care", "Companionship"]
  };

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('http://localhost:8787/api/workers');
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

      const response = await fetch('http://localhost:8787/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workerId,
          serviceType: 'Standard Support',
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) throw new Error('Booking failed');

      const result = await response.json();
      
      setBookingStatus(prev => ({ ...prev, [workerId]: 'success' }));
      setMessages(prev => ({ 
        ...prev, 
        [workerId]: { 
          text: `✅ Request sent to ${workerName}! (Wellness Match: ${result.matchScore || matchScore}%)`, 
          type: 'success' 
        } 
      }));

    } catch (err: any) {
      console.error('❌ Booking error:', err);
      setBookingStatus(prev => ({ ...prev, [workerId]: 'error' }));
      setMessages(prev => ({ 
        ...prev, 
        [workerId]: { text: 'Failed to send request. Try again.', type: 'error' } 
      }));
    }
  };

  // Helper to explain the match
  const getMatchReason = (worker: Worker) => {
    if (!worker.wellnessMatch || worker.wellnessMatch === 0) return "Standard availability";
    const commonInterests = worker.interests.filter(i => clientProfile.interests.includes(i));
    if (commonInterests.length > 0) return `Matched on: ${commonInterests.join(', ')}`;
    return "High skill compatibility";
  };

  if (loading) return <div className="card">Loading support workers...</div>;
  if (error) return <div className="card" style={{color: 'red'}}>Error: {error}</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* --- HERO SECTION: VALUE PROPOSITION --- */}
      <div style={{ background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)', color: 'white', padding: '40px', borderRadius: '12px', marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Direct Care. Zero Fees. Perfect Matches.</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '30px' }}>
          Stop paying agency markups. Connect directly with verified support workers who share your interests.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px 25px', borderRadius: '8px' }}>
            <strong style={{fontSize: '1.5rem'}}>0%</strong><br/>Platform Fees
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px 25px', borderRadius: '8px' }}>
            <strong style={{fontSize: '1.5rem'}}>Instant</strong><br/>Confirmation
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px 25px', borderRadius: '8px' }}>
            <strong style={{fontSize: '1.5rem'}}>Wellness</strong><br/>AI Matching
          </div>
        </div>
      </div>

      {/* --- SUBSCRIPTION PLANS --- */}
      <h2 style={{ marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Choose Your Plan</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {/* Free Plan */}
        <div style={{ border: '1px solid #ddd', padding: '25px', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ color: '#666' }}>Starter</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '15px 0' }}>Free</div>
          <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', lineHeight: '1.8' }}>
            <li>✅ Browse all workers</li>
            <li>✅ Standard Matching</li>
            <li>✅ 0% Platform Fees</li>
            <li style={{ color: '#ccc', textDecoration: 'line-through' }}>❌ Priority Support</li>
            <li style={{ color: '#ccc', textDecoration: 'line-through' }}>❌ Gold Matches (&gt;80%)</li>
          </ul>
          <button style={{ width: '100%', padding: '10px', marginTop: '20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Current Plan</button>
        </div>
        
        {/* Premium Plan */}
        <div style={{ border: '2px solid #007bff', padding: '25px', borderRadius: '12px', textAlign: 'center', position: 'relative', boxShadow: '0 4px 12px rgba(0,123,255,0.15)' }}>
          <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#007bff', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>RECOMMENDED</div>
          <h3 style={{ color: '#007bff' }}>Premium</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '15px 0' }}>$19<span style={{fontSize: '1rem', color: '#666'}}>/mo</span></div>
          <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', lineHeight: '1.8' }}>
            <li>✅ <strong>Everything in Starter</strong></li>
            <li>✅ <strong>Gold Matches</strong> (80%+ Score)</li>
            <li>✅ Priority 24/7 Support</li>
            <li>✅ Advanced Background Checks</li>
            <li>✅ Cancel Anytime</li>
          </ul>
          <button style={{ width: '100%', padding: '10px', marginTop: '20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Upgrade Now</button>
        </div>
      </div>

      {/* --- WORKER LIST --- */}
      <h2 style={{ marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Available Support Workers</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {workers.map((worker) => {
          const status = bookingStatus[worker.id];
          const message = messages[worker.id];
          const matchReason = getMatchReason(worker);

          return (
            <div key={worker.id} className="card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h3 style={{ margin: '0 0 5px 0' }}>{worker.name}</h3>
                  {worker.wellnessMatch !== undefined && (
                    <span style={{ 
                      background: worker.wellnessMatch > 50 ? '#d4edda' : '#fff3cd', 
                      color: worker.wellnessMatch > 50 ? '#155724' : '#856404',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                    }}>
                      {worker.wellnessMatch}% Match
                    </span>
                  )}
                </div>
                <p style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>{matchReason}</p>
                <p style={{ fontSize: '0.9rem', margin: '10px 0' }}>{worker.bio}</p>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Skills:</strong> <span style={{ color: '#555' }}>{worker.skills.join(', ')}</span>
                </div>
                <div style={{ fontWeight: 'bold', color: '#007bff', fontSize: '1.2rem', margin: '15px 0' }}>
                  ${worker.rate}/hr <span style={{ fontSize: '0.8rem', color: '#28a745', fontWeight: 'normal' }}>(No fees)</span>
                </div>
              </div>

              <div>
                {message && (
                  <div style={{ 
                    padding: '8px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.85rem',
                    background: message.type === 'success' ? '#d4edda' : message.type === 'error' ? '#f8d7da' : '#e2e3e5',
                    color: message.type === 'success' ? '#155724' : message.type === 'error' ? '#721c24' : '#383d41'
                  }}>
                    {message.text}
                  </div>
                )}
                <button 
                  className="btn" 
                  onClick={() => handleBookNow(worker.id, worker.name, worker.wellnessMatch)}
                  disabled={status === 'sending'}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: status === 'success' ? '#28a745' : status === 'error' ? '#dc3545' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    opacity: status === 'sending' ? 0.7 : 1,
                    cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {status === 'sending' ? 'Sending...' : 
                   status === 'success' ? '✓ Request Sent' : 
                   status === 'error' ? 'Try Again' : 'Book Now'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {workers.length === 0 && !loading && (
        <div className="card">No workers found.</div>
      )}
    </div>
  );
}