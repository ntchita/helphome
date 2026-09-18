import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError('Cannot reach the server.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="login-page">
        <h1>Check your email</h1>
        <p className="lead">
          If <strong>{email}</strong> matches an account, we've sent a password reset link.
          Click it within 1 hour to set a new password.
        </p>
        <p className="hub-note" style={{ textAlign: 'center' }}>Can't find it? Check Spam or Promotions.</p>
        <button className="btn btn-block" onClick={() => navigate('/login')}>Back to login</button>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Forgot your password?</h1>
      <p className="lead">Enter your email — we'll send you a link to reset it.</p>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <button type="submit" className="btn btn-block" disabled={sending}>
          {sending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <div className="login-footer">
        <p>Remember it? <Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}