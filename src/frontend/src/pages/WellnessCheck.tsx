import { useState } from 'react';

export default function WellnessCheck() {
  const [moodScore, setMoodScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [logType, setLogType] = useState<'worker_mood' | 'client_goal'>('worker_mood');
  const [goalProgress, setGoalProgress] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          logType,
          moodScore: logType === 'worker_mood' ? moodScore : undefined,
          goalProgress: logType === 'client_goal' ? goalProgress : undefined,
          notes,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      alert('Failed to submit wellness check');
    }
  };

  if (submitted) {
    return (
      <div className="wellness-success">
        <h1>Thank you!</h1>
        <p>Your wellness check has been recorded.</p>
        <button onClick={() => {
          setSubmitted(false);
          setNotes('');
          setGoalProgress('');
          setMoodScore(5);
        }}>
          Submit Another Check
        </button>
      </div>
    );
  }

  return (
    <div className="wellness-check-page">
      <h1>Wellness Check-In</h1>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>I am a:</label>
          <select value={logType} onChange={(e) => setLogType(e.target.value as any)}>
            <option value="worker_mood">Support Worker (Mood Check)</option>
            <option value="client_goal">Client (Goal Progress)</option>
          </select>
        </div>

        {logType === 'worker_mood' && (
          <div>
            <label>Mood Score (1-10): {moodScore}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(parseInt(e.target.value))}
            />
            <div className="mood-labels">
              <span>Struggling</span>
              <span>Great</span>
            </div>
          </div>
        )}

        {logType === 'client_goal' && (
          <div>
            <label>Goal Progress:</label>
            <textarea
              value={goalProgress}
              onChange={(e) => setGoalProgress(e.target.value)}
              placeholder="What progress have you made toward your goals?"
              rows={4}
            />
          </div>
        )}

        <div>
          <label>Additional Notes:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other thoughts or feelings..."
            rows={4}
          />
        </div>

        <button type="submit">Submit Check-In</button>
      </form>

      <div className="resources">
        <h2>Need Support?</h2>
        <ul>
          <li><a href="#">Mental Health Resources</a></li>
          <li><a href="#">Worker Burnout Prevention Guide</a></li>
          <li><a href="#">Contact Support Team</a></li>
        </ul>
      </div>
    </div>
  );
}
