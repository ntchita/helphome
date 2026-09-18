import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Missing token'); return; }
    fetch(`/api/verify-email/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStatus('ok');
        else { setStatus('error'); setError(d.error || 'Verification failed'); }
      })
      .catch(() => { setStatus('error'); setError('Cannot reach server'); });
  }, [token]);

  if (status === 'loading') {
    return <div className="page"><div className="card">Verifying your email…</div></div>;
  }

  if (status === 'ok') {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
          <h1 style={{ color: '#27AE60' }}>✓ Email verified</h1>
          <p>Your email is confirmed. You can now sign in.</p>
          <button className="btn btn-block" onClick={() => navigate('/login')}>Go to login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <h1 style={{ color: '#DC3545' }}>Verification failed</h1>
        <p>{error}</p>
        <Link to="/login" className="btn btn-block">Back to login</Link>
      </div>
    </div>
  );
}