import { useEffect, useState } from 'react';

interface Worker {
  id: string;
  bio: string;
  skills: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  verificationStatus: string;
}

export default function WorkerList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

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
              <h3>Support Worker</h3>
              <p>{worker.bio || 'No bio available'}</p>
              <p><strong>Skills:</strong> {worker.skills || 'Not specified'}</p>
              <p><strong>Rate:</strong> ${worker.hourlyRateMin} - ${worker.hourlyRateMax}/hr</p>
              <p>
                <strong>Status:</strong> 
                <span className={`status ${worker.verificationStatus}`}>
                  {worker.verificationStatus}
                </span>
              </p>
              <button onClick={() => alert(`Booking flow for worker ${worker.id} - To be implemented`)}>
                Book Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
