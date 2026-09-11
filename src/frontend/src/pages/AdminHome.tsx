import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminCharts from './AdminCharts';

interface Kpi { label: string; value: string; trend: string; up: boolean; }
interface Alert { id: number; icon: string; level: 'danger' | 'warn' | 'info'; text: string; action: string; link: string; dismissed: boolean; }
interface ActivityItem { time: string; event: string; icon: string; }
interface PeopleRow { label: string; count: number; detail: string; link: string; linkLabel: string; }
interface HealthMetric { label: string; pct: number; warn?: boolean; }

export default function AdminHome() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [people, setPeople] = useState<PeopleRow[]>([]);
  const [health, setHealth] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/kpis').then((r) => r.json()),
      fetch('/api/admin/alerts').then((r) => r.json()),
      fetch('/api/admin/activity').then((r) => r.json()),
      fetch('/api/admin/people').then((r) => r.json()),
      fetch('/api/admin/health').then((r) => r.json()),
    ])
      .then(([k, a, act, p, h]) => {
        setKpis(k);
        setAlerts(a);
        setActivity(act);
        setPeople(p);
        setHealth(h);
      })
      .catch((err) => console.error('❌ Failed to fetch admin data:', err))
      .finally(() => setLoading(false));
  }, []);

  const dismiss = (id: number) => {
    fetch(`/api/admin/alerts/${id}/dismiss`, { method: 'POST' }).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  };

  if (loading) return <div className="card">Loading dashboard...</div>;

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  return (
    <div className="page admin-home-page">
      <header className="hub-header">
        <h1>Admin Dashboard</h1>
        <p className="hub-note">Platform operations — representative pilot data.</p>
      </header>

      <section className="kpi-strip">
        {kpis.map((k, i) => (
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
          {people.map((p, i) => (
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
            {health.map((h, i) => (
              <div className="health-row" key={i}>
                <span>{h.label}</span>
                <div className="capacity-bar"><div className={`capacity-fill ${h.warn ? 'warn' : ''}`} style={{ width: `${h.pct}%` }} /></div>
                <span className="capacity-pct">{h.pct}%</span>
              </div>
            ))}
          </div>
          <p className="hub-explain">Pilot metrics. Post-pilot these read from real-time data.</p>
        </article>

        <article className="card admin-card">
          <h3>🕐 Recent activity</h3>
          <div className="activity-feed">
            {activity.map((a, i) => (
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