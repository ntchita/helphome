import { useEffect, useState } from 'react';

interface Worker {
  id: string;
  name: string;
  bio: string;
  skills: string[];
  interests: string[];
  hourlyRate: number;
  verificationStatus: string;
  wellnessMatchScore?: number;
}

export default function WorkerList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  // Track booking status per worker: 'sending' | 'success' | 'error' | null
  const [bookingStatus, setBookingStatus] = useState<{ [key: string]: 'sending' | 'success' | 'error' | null }>({});

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/workers');
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (err) {
      console.error('Failed to fetch workers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = async (workerId: string, workerName: string) => {
    // 1. Set state to 'sending'
    setBookingStatus(prev => ({ ...prev, [workerId]: 'sending' }));
    
    try {
      // 2. Call the real backend API
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          // Add userId or other details here if available
        }),
      });

      if (!response.ok) {
        throw new Error('Booking failed');
      }

      const result = await response.json();
      
      // 3. Set state to 'success' (NO ALERT)
      setBookingStatus(prev => ({ ...prev, [workerId]: 'success' }));
      
      // Optional: Log to console instead of alerting
      console.log(`Booking successful for ${workerName}. Match Score: ${result.matchScore}`);

    } catch (err) {
      console.error('Booking error:', err);
      // 4. Set state to 'error' (NO ALERT)
      setBookingStatus(prev => ({ ...prev, [workerId]: 'error' }));
    }
  };

  if (loading) return <div>Loading workers...</div>;

  return (
    <div className="worker-list-page">
      <h1>Find a Support Worker</h1>
      
      {workers.length === 0 ? (
        <p>No workers available yet.</p>
      ) : (
        <div className="worker-grid">
          {workers.map((worker) => (
            <div key={worker.id} className="worker-card">
              <h3>{worker.name || 'Support Worker'}</h3>
              
              {worker.wellnessMatchScore !== undefined && (
                <p><strong>Wellness Match:</strong> {worker.wellnessMatchScore}%</p>
              )}
              
              <p>{worker.bio || 'No bio available'}</p>
              
              <p><strong>Skills:</strong> {worker.skills?.join(', ') || 'Not specified'}</p>
              
              {worker.interests?.length > 0 && (
                <p><strong>Interests:</strong> {worker.interests.join(', ')}</p>
              )}
              
              <p><strong>Rate:</strong> ${worker.hourlyRate}/hr</p>
              
              <p>
                <strong>Status:</strong> 
                <span className={`status ${worker.verificationStatus}`}>
                  {worker.verificationStatus}
                </span>
              </p>

              {/* Button updates text based on status, NO ALERTS */}
              <button
				  className={`btn btn-block ${bookingStatus[worker.id] === 'success' ? 'btn-success' : ''}`}
				  onClick={() => handleBookNow(worker.id, worker.name || 'Worker')}
				  disabled={bookingStatus[worker.id] === 'sending' || bookingStatus[worker.id] === 'success'}
				>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}