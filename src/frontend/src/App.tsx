import { useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import WellnessCheck from './pages/WellnessCheck';
import WorkerHome from './pages/WorkerHome';
import CoordinatorHub from './pages/CoordinatorHub';
import AdminDashboard from './pages/AdminDashboard';
import AdminHome from './pages/AdminHome';
import ClientRequests from './pages/ClientRequests';
import Login from './pages/Login';

type Role = 'client' | 'worker' | 'coordinator' | 'admin' | null;

const ROLE_HOME: { [r: string]: string } = {
  client: '/dashboard',
  worker: '/my-hub',
  coordinator: '/coordinator',
  admin: '/admin',
};

function App() {
  const [role, setRole] = useState<Role>(() =>
    localStorage.getItem('helphome_logged_in') === 'true'
      ? (localStorage.getItem('helphome_role') as Role)
      : null
  );

  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  
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
          <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
          <div className={`nav-links ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            {role === 'client' && (
              <>
                <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
                <Link to="/wellness" className={location.pathname === '/wellness' ? 'active' : ''}>Wellness</Link>
              </>
            )}
            {role === 'admin' && <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Admin Dashboard</Link>}
            {role === 'worker' && <Link to="/my-hub" className={location.pathname === '/my-hub' ? 'active' : ''}>My Hub</Link>}
            {(role === 'coordinator' || role === 'admin') && (
              <>
                <Link to="/coordinator" className={location.pathname === '/coordinator' ? 'active' : ''}>Coordinator Hub</Link>
                <Link to="/verification" className={location.pathname === '/verification' ? 'active' : ''}>Verification</Link>
              </>
            )}
            {role === 'admin' && <Link to="/requests" className={location.pathname === '/requests' ? 'active' : ''}>Client Requests</Link>}
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
          <Route path="/dashboard" element={role === 'client' ? <Dashboard /> : bounce} />
          <Route path="/wellness" element={role === 'client' ? <WellnessCheck /> : bounce} />
          <Route path="/my-hub" element={role === 'worker' ? <WorkerHome /> : bounce} />
          <Route path="/coordinator" element={(role === 'coordinator' || role === 'admin') ? <CoordinatorHub /> : bounce} />
          <Route path="/admin" element={role === 'admin' ? <AdminHome /> : bounce} />
          <Route path="/verification" element={(role === 'coordinator' || role === 'admin') ? <AdminDashboard /> : bounce} />
          <Route path="/requests" element={role === 'admin' ? <ClientRequests /> : bounce} />
          <Route path="*" element={bounce} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
