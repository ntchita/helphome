import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import WorkerList from './pages/WorkerList';
import BookingDetail from './pages/BookingDetail';
import WellnessCheck from './pages/WellnessCheck';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workers" element={<WorkerList />} />
        <Route path="/bookings/:id" element={<BookingDetail />} />
        <Route path="/wellness" element={<WellnessCheck />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </div>
  );
}

export default App;
