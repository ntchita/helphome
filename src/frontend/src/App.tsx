import { Routes, Route, Link } from 'react-router-dom'; // No BrowserRouter import needed
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    // NO BrowserRouter here anymore
    <div>
      <nav style={{ background: '#008080', padding: '1rem', color: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0 }}>Helphome</h1>
          <div>
            <Link to="/" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>Home</Link>
            <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link>
          </div>
        </div>
      </nav>
      
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
