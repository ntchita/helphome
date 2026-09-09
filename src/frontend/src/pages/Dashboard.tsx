import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    // TODO: Fetch real data from API
    setBookings([
      { id: 1, worker: 'Jane Doe', date: '2024-03-20', status: 'Confirmed' },
      { id: 2, worker: 'John Smith', date: '2024-03-22', status: 'Pending' }
    ])
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Dashboard</h2>
      <h3>Upcoming Bookings</h3>
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
          {bookings.map((b: any) => (
            <li key={b.id} style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
              <strong>{b.worker}</strong> - {b.date} <span style={{ color: b.status === 'Confirmed' ? 'green' : 'orange' }}>({b.status})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
