import { useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import WellnessCheck from './pages/WellnessCheck';
import WorkerHub from './pages/WorkerHub';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';

type Role = 'client' | 'worker' | 'admin' | null;

const ROLE_HOME: { [r: string]: string } = {
  client: '/dashboard',
  worker: '/worker-hub',
  admin: '/admin',
};

function App() {
  const [role, setRole] = useState<Role>(() =>
    localStorage.getItem('helphome_logged_in') === 'true'
      ? (localStorage.getItem('helphome_role') as Role)
      : null
  );

  const location = useLocation();
  
  const logout = () => {
    localStorage.removeItem('helphome_logged_in');
    localStorage.removeItem('helphome_role');
    setRole(null);
  };

  const allow = (needed: Role) => role === needed;
  const bounce = <Navigate to={role ? ROLE_HOME[role] : '/login'} replace />;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-content">
          <span>📞 1800 849 279</span>
          <span>✉️ admin@helphome.au</span>
        </div>
      </div>

      <nav>
        <div className="nav-content">
          <Link to="/" className="brand">HelpHome</Link>
		   <div className="nav-links">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            {role === 'client' && (
              <>
                <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
                <Link to="/wellness" className={location.pathname === '/wellness' ? 'active' : ''}>Wellness</Link>
              </>
            )}
            {role === 'worker' && <Link to="/worker-hub" className={location.pathname === '/worker-hub' ? 'active' : ''}>Worker Hub</Link>}
            {role === 'admin' && <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Coordinator</Link>}
            {role ? (
              <Link to="/" onClick={logout}>Log out</Link>
            ) : (
              <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>Login</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onLogin={() => setRole(localStorage.getItem('helphome_role') as Role)} />} />
          <Route path="/dashboard" element={allow('client') ? <Dashboard /> : bounce} />
          <Route path="/wellness" element={allow('client') ? <WellnessCheck /> : bounce} />
          <Route path="/worker-hub" element={allow('worker') ? <WorkerHub /> : bounce} />
          <Route path="/admin" element={allow('admin') ? <AdminDashboard /> : bounce} />
          <Route path="*" element={bounce} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
