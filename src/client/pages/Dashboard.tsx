import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      fetchBookings();
    }
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="dashboard-page">
      <h1>Welcome, {user.email}</h1>
      <p>Role: {user.role}</p>
      
      <h2>Your Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <ul>
          {bookings.map((booking) => (
            <li key={booking.id}>
              <strong>Status:</strong> {booking.status}<br />
              <strong>Start:</strong> {new Date(booking.startTime).toLocaleString()}<br />
              <strong>End:</strong> {new Date(booking.endTime).toLocaleString()}<br />
              <strong>Amount:</strong> ${booking.totalAmount.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
      
      {user.role === 'client' && (
        <a href="/workers" className="button">Find a Worker</a>
      )}
    </div>
  );
}
