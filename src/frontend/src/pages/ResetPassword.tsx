import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || 'Reset failed.'); return; }
      setDone(true);
    } catch {
      setError('Cannot reach the server.');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <h1>Invalid link</h1>
        <p className="lead">This password reset link is missing a token.</p>
        <button className="btn btn-block" onClick={() => navigate('/forgot-password')}>Request a new link</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="login-page">
        <h1 style={{ color: '#27AE60' }}>✓ Password updated</h1>
        <p className="lead">You can now log in with your new password.</p>
        <button className="btn btn-block" onClick={() => navigate('/login')}>Go to login</button>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Set a new password</h1>
      <p className="lead">Choose a strong password (min 8 characters).</p>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label>New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
        </div>
        <div>
          <label>Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" required />
        </div>
        <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}