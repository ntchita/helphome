import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const fetchBooking = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBooking(data.booking);
    } catch (err) {
      console.error('Failed to fetch booking:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      alert(`Booking ${status}`);
      fetchBooking();
    } catch (err) {
      alert('Failed to update booking');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!booking) return <div>Booking not found</div>;

  return (
    <div className="booking-detail-page">
      <h1>Booking Details</h1>
      
      <div className="booking-info">
        <p><strong>Status:</strong> {booking.status}</p>
        <p><strong>Start:</strong> {new Date(booking.startTime).toLocaleString()}</p>
        <p><strong>End:</strong> {new Date(booking.endTime).toLocaleString()}</p>
        <p><strong>Service Type:</strong> {booking.serviceType}</p>
        <p><strong>Hourly Rate:</strong> ${booking.hourlyRate}</p>
        <p><strong>Total Amount:</strong> ${booking.totalAmount.toFixed(2)}</p>
        <p><strong>Location:</strong> {booking.locationAddress}</p>
        <p><strong>Notes:</strong> {booking.notes}</p>
      </div>

      {booking.status === 'pending' && (
        <div className="actions">
          <button onClick={() => updateStatus('confirmed')}>Accept Booking</button>
          <button onClick={() => updateStatus('cancelled')}>Decline Booking</button>
        </div>
      )}

      <button onClick={() => navigate(-1)} className="secondary">Back</button>
    </div>
  );
}
