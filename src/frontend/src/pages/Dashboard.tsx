import { useEffect, useState } from 'react';

// Define the Worker type
interface Worker {
  id: number;
  name: string;
  skill: string;
  rate: number;
  bio: string;
}

export default function Dashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        // FORCE ABSOLUTE URL TO BACKEND PORT 8787
        const response = await fetch('http://localhost:8787/api/workers');
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Is the backend running on port 8787?');
          }
          if (response.status === 404) {
            throw new Error('Endpoint not found. Check backend routes.');
          }
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Workers fetched successfully:', data);
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

  if (loading) return <div className="card">Loading support workers...</div>;
  if (error) return <div className="card" style={{color: 'red'}}>Error: {error}</div>;

return (
    <div>
      <h2>🔍 Find Support Workers</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {workers.map((worker) => (
          <div key={worker.id} className="card" style={{ marginBottom: 0 }}>
            <h3>{worker.name}</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>{worker.skill}</p>
            <p style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>{worker.bio}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
              <span style={{ fontWeight: 'bold', color: '#007bff' }}>${worker.rate}/hr</span>
              <button 
                className="btn" 
                onClick={() => alert(`Booking request sent to ${worker.name}! (Backend integration pending)`)}
              >
                Book Now
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {workers.length === 0 && !loading && (
        <div className="card">No workers found. Ensure backend has mock data.</div>
      )}
    </div>
  );
}