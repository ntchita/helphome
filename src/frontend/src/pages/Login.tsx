import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface DemoAccount { label: string; email: string; }

const HOMES: { [role: string]: string } = {
  client: '/dashboard',
  worker: '/my-hub',
  manager: '/manager',
  admin: '/admin',
};

export default function Login({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch('/api/demo-accounts')
      .then((r) => r.json())
      .then((data) => setAccounts(data))
      .catch(() => setError('Cannot reach the server. Is the API running?'));
  }, []);

  const fill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('test');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (result.ok && result.role) {
        localStorage.setItem('helphome_logged_in', 'true');
        localStorage.setItem('helphome_role', result.role);
        onLogin();
        navigate(HOMES[result.role]);
      } else {
        setError('Invalid credentials. Pick a role button above.');
      }
    } catch {
      setError('Cannot reach the server. Is the API running?');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="login-page">
      <h1>Welcome back</h1>
      <p className="lead">Sign in to access your dashboard and wellness tools.</p>
      <div className="demo-hint">
        <p><em>Choose a demo role:</em></p>
        <div className="role-buttons">
          {accounts.map((a) => (
            <button type="button" key={a.email} onClick={() => fill(a.email)}>{a.label}</button>
          ))}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn-block" disabled={checking}>
          {checking ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div className="login-footer">
        <p>New to HelpHome? Accounts are created during pilot onboarding.</p>
      </div>
    </div>
  );
}