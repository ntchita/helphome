const WELLNESS_TREND = [
  { day: 'Mon', score: 6.2 },
  { day: 'Tue', score: 6.5 },
  { day: 'Wed', score: 6.4 },
  { day: 'Thu', score: 6.8 },
  { day: 'Fri', score: 7.1 },
  { day: 'Sat', score: 7.0 },
  { day: 'Sun', score: 7.4 },
];

const BOOKING_STATUS = [
  { label: 'Accepted', value: 3, color: '#00D68F' },
  { label: 'Pending', value: 1, color: '#F39C12' },
  { label: 'Declined', value: 2, color: '#DC3545' },
];

const REVENUE = [
  { month: 'Apr', amount: 420 },
  { month: 'May', amount: 610 },
  { month: 'Jun', amount: 580 },
  { month: 'Jul', amount: 760 },
  { month: 'Aug', amount: 940 },
  { month: 'Sep', amount: 1180 },
];

const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`);

export default function AdminCharts() {
  const W = 320, H = 170;
  const min = 5.5, max = 8;
  const px = (i: number) => 20 + (i * (W - 40)) / (WELLNESS_TREND.length - 1);
  const py = (s: number) => 150 - ((s - min) / (max - min)) * 120;
  const pts = WELLNESS_TREND.map((d, i) => `${px(i)},${py(d.score)}`).join(' ');
  const area = `M${px(0)},150 L${WELLNESS_TREND.map((d, i) => `${px(i)},${py(d.score)}`).join(' L')} L${px(WELLNESS_TREND.length - 1)},150 Z`;

  const totalBookings = BOOKING_STATUS.reduce((a, b) => a + b.value, 0);
  const C = 2 * Math.PI * 54;
  let cum = 0;
  const segs = BOOKING_STATUS.map((s) => {
    const frac = s.value / totalBookings;
    const seg = { ...s, frac, offset: cum };
    cum += frac;
    return seg;
  });

  const maxRev = Math.max(...REVENUE.map((r) => r.amount));

  return (
    <section className="charts-grid">
      <article className="chart-card">
        <h3>💚 Worker wellness trend</h3>
        <p className="hub-explain">Platform average check-in score, last 7 days</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wellness trend line chart">
          <defs>
            <linearGradient id="wellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D68F" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00D68F" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#wellGrad)" className="chart-area" />
          <polyline points={pts} fill="none" stroke="#00A876" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />
          {WELLNESS_TREND.map((d, i) => (
            <circle key={d.day} cx={px(i)} cy={py(d.score)} r="4" fill="#fff" stroke="#00A876" strokeWidth="2.5">
              <title>{`${d.day}: ${d.score}/10`}</title>
            </circle>
          ))}
          {WELLNESS_TREND.map((d, i) => (
            <text key={`${d.day}-l`} x={px(i)} y={H - 4} textAnchor="middle" className="chart-axis">{d.day}</text>
          ))}
        </svg>
        <p className="chart-foot">↑ +1.2 pts this week — welfare chat with John Smith scheduled</p>
      </article>

      <article className="chart-card">
        <h3>📋 Booking status</h3>
        <p className="hub-explain">Client requests this week</p>
        <div className="donut-wrap">
          <svg viewBox="0 0 140 140" role="img" aria-label="Booking status donut chart">
            <g transform="rotate(-90 70 70)">
              {segs.map((s, i) => (
                <circle key={s.label} cx="70" cy="70" r="54" fill="none" stroke={s.color} strokeWidth="20"
                  strokeDasharray={`${s.frac * C} ${C - s.frac * C}`} strokeDashoffset={-s.offset * C}
                  className="chart-seg" style={{ animationDelay: `${i * 0.15}s` }}>
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              ))}
            </g>
            <text x="70" y="66" textAnchor="middle" className="donut-num">{totalBookings}</text>
            <text x="70" y="84" textAnchor="middle" className="donut-sub">bookings</text>
          </svg>
          <ul className="donut-legend">
            {BOOKING_STATUS.map((s) => (
              <li key={s.label}>
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label} <strong>{s.value}</strong>
              </li>
            ))}
          </ul>
        </div>
        <p className="chart-foot">67% acceptance — declined requests auto re-matched, no penalty</p>
      </article>

      <article className="chart-card">
        <h3>💰 Pilot revenue</h3>
        <p className="hub-explain">Monthly platform revenue (demo figures)</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly revenue bar chart">
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00A3E0" />
              <stop offset="100%" stopColor="#0087C2" />
            </linearGradient>
          </defs>
          {REVENUE.map((r, i) => {
            const h = (r.amount / maxRev) * 120;
            const x = 18 + i * 50;
            return (
              <g key={r.month}>
                <rect x={x} y={150 - h} width="34" height={h} rx="6" fill="url(#revGrad)"
                  className="chart-bar" style={{ animationDelay: `${i * 0.1}s` }}>
                  <title>{`${r.month}: $${r.amount}`}</title>
                </rect>
                <text x={x + 17} y={144 - h} textAnchor="middle" className="chart-val">{fmt(r.amount)}</text>
                <text x={x + 17} y={H - 4} textAnchor="middle" className="chart-axis">{r.month}</text>
              </g>
            );
          })}
        </svg>
        <p className="chart-foot">Post-pilot: live-synced from Xero — invoicing, payroll, P&amp;Ls, forecasting</p>
      </article>
    </section>
  );
}