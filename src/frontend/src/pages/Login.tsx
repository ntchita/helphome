import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACCOUNTS: { [email: string]: string } = {
  'client@test.com': 'client',
  'worker@test.com': 'worker',
  'manager@test.com': 'manager',
  'admin@test.com': 'admin',
};

const HOMES: { [role: string]: string } = {
  client: '/dashboard',
  worker: '/my-hub',
  manager: '/manager',
  admin: '/admin',
};

export default function Login({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const fill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('test');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = ACCOUNTS[email];
    if (role && password === 'test') {
      localStorage.setItem('helphome_logged_in', 'true');
      localStorage.setItem('helphome_role', role);
      onLogin();
      navigate(HOMES[role]);
    } else {
      setError('Invalid credentials. Pick a role button above.');
    }
  };

  return (
    <div className="login-page">
      <h1>Welcome back</h1>
      <p className="lead">Sign in to access your dashboard and wellness tools.</p>

      <div className="demo-hint">
        <p><em>Choose a demo role:</em></p>
        <div className="role-buttons">
          <button type="button" onClick={() => fill('client@test.com')}>Client</button>
          <button type="button" onClick={() => fill('worker@test.com')}>Worker</button>
          <button type="button" onClick={() => fill('manager@test.com')}>Manager</button>
          <button type="button" onClick={() => fill('admin@test.com')}>Admin</button>
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
        <button type="submit" className="btn btn-block">Sign in</button>
      </form>

      <div className="login-footer">
        <p>New to HelpHome? Accounts are created during pilot onboarding.</p>
      </div>
    </div>
  );
}
