export default function WorkerHub() {
  const capacity = { booked: 22, total: 30 };
  const pct = Math.round((capacity.booked / capacity.total) * 100);

  return (
    <div className="page worker-hub-page">
      <header className="hub-header">
        <h1>Worker Hub</h1>
        <p className="hub-sub">Jane Doe · Support Worker</p>
        <p className="hub-note">Representative worker view — pilot data.</p>
      </header>

      <section className="hub-grid">
        <article className="card hub-card">
          <h3>This week's capacity</h3>
          <div className="capacity-row">
            <strong>{capacity.booked} of {capacity.total} hrs</strong>
            <span className="capacity-pct">{pct}% booked</span>
          </div>
          <div className="capacity-bar"><div className="capacity-fill" style={{ width: `${pct}%` }} /></div>
          <p className="hub-explain">
            We cap bookings at 85%. Overbooked workers burn out; burned-out workers quit;
            quitting breaks care continuity. Your wellbeing is the product.
          </p>
        </article>

        <article className="card hub-card">
          <h3>Incoming request</h3>
          <p className="request-client"><strong>Sarah Lee</strong> · Community Access</p>
          <p className="request-meta">Thu 9:00–13:00 · Matched on: music · 80% wellness match</p>
          <div className="request-actions">
            <button className="btn">Accept</button>
            <button className="btn secondary">Decline</button>
          </div>
          <p className="hub-explain">Declining never affects your rating. No penalty, ever.</p>
        </article>

        <article className="card hub-card">
          <h3>Your wellbeing trend</h3>
          <div className="mood-bars">
            <div className="mood-bar" style={{ height: '60%' }} /><span>Mon</span>
            <div className="mood-bar" style={{ height: '80%' }} /><span>Tue</span>
            <div className="mood-bar" style={{ height: '45%' }} /><span>Wed</span>
            <div className="mood-bar" style={{ height: '70%' }} /><span>Thu</span>
          </div>
          <button className="btn btn-block">Flag I need support</button>
        </article>
      </section>
    </div>
  );
}