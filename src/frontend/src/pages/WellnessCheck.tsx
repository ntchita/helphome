import { useState } from 'react';

type CheckType = 'mood' | 'goals' | 'satisfaction';

const CHECK_META: { [k in CheckType]: { question: string; low: string; high: string } } = {
  mood: { question: 'How are you feeling this week?', low: 'Struggling', high: 'Great' },
  goals: { question: 'How are your support goals progressing?', low: 'Stalled', high: 'Advancing' },
  satisfaction: { question: 'How happy are you with your support this week?', low: 'Unhappy', high: 'Delighted' },
};

export default function WellnessCheck() {
  const [logType, setLogType] = useState<CheckType>('mood');
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const meta = CHECK_META[logType];

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
        body: JSON.stringify({ logType, score, notes }),
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
          setScore(5);
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
          <label>This check-in is about:</label>
          <select value={logType} onChange={(e) => setLogType(e.target.value as CheckType)}>
            <option value="mood">Mood & Wellbeing</option>
            <option value="goals">Goal Progress</option>
            <option value="satisfaction">Care Satisfaction</option>
          </select>
        </div>
        <div>
          <label>{meta.question} Score (1–10): {score}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={score}
            onChange={(e) => setScore(parseInt(e.target.value))}
          />
          <div className="mood-labels">
            <span>{meta.low}</span>
            <span>{meta.high}</span>
          </div>
        </div>
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
          <li><a href="#">NDIS Participant Guides</a></li>
          <li><a href="#">Contact Support Team</a></li>
        </ul>
      </div>
    </div>
  );
}