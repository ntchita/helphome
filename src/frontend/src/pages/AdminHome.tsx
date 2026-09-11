import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminCharts from './AdminCharts';

const KPIS = [
  { label: 'Active clients', value: '12', trend: '+3 this month', up: true },
  { label: 'Active workers', value: '3', trend: 'Pilot capacity', up: true },
  { label: 'Managers', value: '2', trend: '+1 pending invite', up: true },
  { label: 'Bookings this week', value: '6', trend: '↑ from 4 last week', up: true },
  { label: 'Acceptance rate', value: '67%', trend: '4 of 6 accepted', up: false },
  { label: 'Avg wellness match', value: '78%', trend: '↑ from 71%', up: true },
];

interface Alert {
  id: number;
  icon: string;
  level: 'danger' | 'warn' | 'info';
  text: string;
  action: string;
  link: string;
  dismissed: boolean;
}

const INITIAL_ALERTS: Alert[] = [
  { id: 1, icon: '🔴', level: 'danger', text: 'John Smith — wellbeing At Risk. Welfare chat scheduled by manager.', action: 'View in Manager Hub', link: '/manager', dismissed: false },
  { id: 2, icon: '🟡', level: 'warn', text: '1 verification pending — John Smith (Transport). Background check awaiting review.', action: 'Open Verification Queue', link: '/verification', dismissed: false },
  { id: 3, icon: '🟡', level: 'warn', text: '2 client requests declined this week. Auto re-match offered to clients.', action: 'View Client Requests', link: '/requests', dismissed: false },
  { id: 4, icon: '🔵', level: 'info', text: 'Worker capacity at 71% average across roster. No overload flags.', action: 'View Manager Hub', link: '/manager', dismissed: false },
];

const ACTIVITY = [
  { time: 'Today 11:42', event: 'Jane Doe accepted booking — Mark T. · Personal Care · Fri 10:00', icon: '✅' },
  { time: 'Today 10:15', event: 'Jane Doe submitted wellbeing check-in — Load & Energy: 7/10', icon: '💚' },
  { time: 'Today 09:30', event: 'Manager scheduled welfare chat with John Smith', icon: '📞' },
  { time: 'Yesterday', event: 'Mei L. booked Sarah Lee — Community Access · Wed 13:00', icon: '📋' },
  { time: 'Yesterday', event: 'Sarah Lee submitted wellbeing check-in — Feeling Supported: 8/10', icon: '💚' },
  { time: 'Mon', event: 'John Smith declined booking — Dana W. · Transport (no penalty applied)', icon: '↩️' },
  { time: 'Mon', event: 'New worker application received — John Smith (Transport)', icon: '🆕' },
  { time: 'Mon', event: 'Tom B. booking declined by John Smith — auto re-match triggered', icon: '🔄' },
];

const PEOPLE = [
  { label: 'Clients', count: 12, detail: '2 new this week · 4 active bookings', link: '/requests', linkLabel: 'Client Requests →' },
  { label: 'Workers', count: 3, detail: '1 flagged (At Risk) · avg 71% capacity', link: '/manager', linkLabel: 'Manager Hub →' },
  { label: 'Managers', count: 2, detail: '1 active · 1 pending invite', link: '', linkLabel: 'Roster view post-pilot' },
];

export default function AdminHome() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);

  const dismiss = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  };

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  return (
    <div className="page admin-home-page">
      <header className="hub-header">
        <h1>Admin Dashboard</h1>
        <p className="hub-note">Platform operations — representative pilot data.</p>
      </header>

      <section className="kpi-strip">
        {KPIS.map((k, i) => (
          <div className="kpi-card" key={i}>
            <span className="kpi-value">{k.value}</span>
            <span className="kpi-label">{k.label}</span>
            <span className={`kpi-trend ${k.up ? 'up' : 'down'}`}>{k.trend}</span>
          </div>
        ))}
      </section>
	  
	  <AdminCharts />

      <section className="admin-grid">
        <article className="card admin-card attention-card">
          <h3>⚡ Needs your attention <span className="attention-count">{activeAlerts.length}</span></h3>
          {activeAlerts.length === 0 && <p className="hub-explain">All clear — no items need attention right now.</p>}
          {activeAlerts.map((a) => (
            <div className={`alert-row alert-${a.level}`} key={a.id}>
              <div className="alert-body">
                <span className="alert-icon">{a.icon}</span>
                <p>{a.text}</p>
              </div>
              <div className="alert-actions">
                <Link to={a.link} className="alert-link">{a.action}</Link>
                <button className="alert-dismiss" onClick={() => dismiss(a.id)}>✕</button>
              </div>
            </div>
          ))}
        </article>

        <article className="card admin-card">
          <h3>👥 People you manage</h3>
          {PEOPLE.map((p, i) => (
            <div className="people-row" key={i}>
              <div>
                <p className="people-label"><strong>{p.count}</strong> {p.label}</p>
                <p className="hub-explain">{p.detail}</p>
              </div>
              {p.link ? (
                <Link to={p.link} className="people-link">{p.linkLabel}</Link>
              ) : (
                <span className="people-link muted-link">{p.linkLabel}</span>
              )}
            </div>
          ))}
        </article>

        <article className="card admin-card">
          <h3>📊 Platform health</h3>
          <div className="health-bars">
            <div className="health-row">
              <span>Worker capacity</span>
              <div className="capacity-bar"><div className="capacity-fill" style={{ width: '71%' }} /></div>
              <span className="capacity-pct">71%</span>
            </div>
            <div className="health-row">
              <span>Booking acceptance</span>
              <div className="capacity-bar"><div className="capacity-fill warn" style={{ width: '67%' }} /></div>
              <span className="capacity-pct">67%</span>
            </div>
            <div className="health-row">
              <span>Wellness engagement</span>
              <div className="capacity-bar"><div className="capacity-fill" style={{ width: '83%' }} /></div>
              <span className="capacity-pct">83%</span>
            </div>
            <div className="health-row">
              <span>Client satisfaction</span>
              <div className="capacity-bar"><div className="capacity-fill" style={{ width: '92%' }} /></div>
              <span className="capacity-pct">92%</span>
            </div>
          </div>
          <p className="hub-explain">Pilot metrics. Post-pilot these read from real-time data.</p>
        </article>

        <article className="card admin-card">
          <h3>🕐 Recent activity</h3>
          <div className="activity-feed">
            {ACTIVITY.map((a, i) => (
              <div className="activity-row" key={i}>
                <span className="activity-icon">{a.icon}</span>
                <div>
                  <p className="activity-event">{a.event}</p>
                  <span className="activity-time">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="quick-links">
        <Link to="/manager" className="quick-link-card">
          <span className="ql-icon">👷</span>
          <span>Manager Hub</span>
        </Link>
        <Link to="/verification" className="quick-link-card">
          <span className="ql-icon">✅</span>
          <span>Verification Queue</span>
        </Link>
        <Link to="/requests" className="quick-link-card">
          <span className="ql-icon">📋</span>
          <span>Client Requests</span>
        </Link>
      </section>
    </div>
  );
}