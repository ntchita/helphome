import { useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import WellnessCheck from './pages/WellnessCheck';
import WorkerHome from './pages/WorkerHome';
import ManagerHub from './pages/ManagerHub';
import AdminDashboard from './pages/AdminDashboard';
import AdminHome from './pages/AdminHome';
import ClientRequests from './pages/ClientRequests';
import Login from './pages/Login';
import Register from './pages/Register';

type Role = 'client' | 'worker' | 'manager' | 'admin' | null;

// Bump this on every production deploy: sessions created by older builds
// are cleared automatically on next page load.
const BUILD_ID = '10-09-2026-v4';

const ROLE_HOME: { [r: string]: string } = {
  client: '/dashboard',
  worker: '/my-hub',
  manager: '/manager',
  admin: '/admin',
};

function App() {
  const [role, setRole] = useState<Role>(() => {
    if (localStorage.getItem('helphome_build') !== BUILD_ID) {
      localStorage.removeItem('helphome_logged_in');
      localStorage.removeItem('helphome_role');
      localStorage.setItem('helphome_build', BUILD_ID);
      return null;
    }
    return localStorage.getItem('helphome_logged_in') === 'true'
      ? (localStorage.getItem('helphome_role') as Role)
      : null;
  });

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
            {(role === 'manager' || role === 'admin') && (
              <>
                <Link to="/manager" className={location.pathname === '/manager' ? 'active' : ''}>Manager Hub</Link>
                <Link to="/verification" className={location.pathname === '/verification' ? 'active' : ''}>Verification</Link>
              </>
            )}
            {role === 'admin' && <Link to="/requests" className={location.pathname === '/requests' ? 'active' : ''}>Client Requests</Link>}
            {role ? (
              <Link to="/" onClick={logout}>Log out</Link>
            ) : (
			  <>
              <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>Login</Link>
			  <Link to="/register" className={location.pathname === '/register' ? 'active' : ''}>Register</Link>
			  </>
			)}
          </div>
        </div>
      </nav>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onLogin={() => setRole(localStorage.getItem('helphome_role') as Role)} />} />
		  <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={role === 'client' ? <Dashboard /> : bounce} />
          <Route path="/wellness" element={role === 'client' ? <WellnessCheck /> : bounce} />
          <Route path="/my-hub" element={role === 'worker' ? <WorkerHome /> : bounce} />
          <Route path="/manager" element={(role === 'manager' || role === 'admin') ? <ManagerHub /> : bounce} />
          <Route path="/admin" element={role === 'admin' ? <AdminHome /> : bounce} />
          <Route path="/verification" element={(role === 'manager' || role === 'admin') ? <AdminDashboard /> : bounce} />
          <Route path="/requests" element={role === 'admin' ? <ClientRequests /> : bounce} />
          <Route path="*" element={bounce} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
