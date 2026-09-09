import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import WellnessCheck from './pages/WellnessCheck';
import WorkerHub from './pages/WorkerHub';

function App() {
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
            <Link to="/">Home</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/wellness">Wellness</Link>
			<Link to="/worker-hub">Worker Hub</Link>
          </div>
        </div>
      </nav>
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wellness" element={<WellnessCheck />} />
		  <Route path="/worker-hub" element={<WorkerHub />} />
        </Routes>
      </main>
    </div>
  );
}
export default App;
