import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { calculateWellnessMatch, rankWorkers } from './utils/matcher.ts';

const app = new Hono();

// Enable CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// --- REAL DATA WITH INTERESTS FOR WELLNESS MATCHING ---
const workers = [
  { 
    id: 1, 
    name: "Jane Doe", 
    skills: ["Personal Care", "Medication"], 
    interests: ["dogs", "gardening", "classic movies"], 
    rate: 45, 
    bio: "Experienced support worker who loves animals." 
  },
  { 
    id: 2, 
    name: "John Smith", 
    skills: ["Transport", "Community Access"], 
    interests: ["sports", "fitness", "coaching"], 
    rate: 40, 
    bio: "Former coach, great for active clients." 
  },
  { 
    id: 3, 
    name: "Sarah Lee", 
    skills: ["Community Access", "Social Support"], 
    interests: ["music", "art", "museums"], 
    rate: 50, 
    bio: "Artist at heart, love cultural outings." 
  }
];

// Simulating a logged-in client profile for the demo
const demoClientProfile = {
  interests: ["dogs", "music", "outdoors"],
  needs: ["Personal Care", "Companionship"]
};

app.get('/', (c) => c.json({ message: 'Helphome API Active', version: '1.0.0' }));

// GET Workers with REAL Wellness Matching Scores
app.get('/api/workers', async (c) => {
  // 1. Rank workers based on wellness/interest match
  const ranked = rankWorkers(workers, demoClientProfile);
  
  // 2. Attach the calculated score to the response
  const response_data = ranked.map(w => ({
    ...w,
    wellnessMatch: calculateWellnessMatch(w, demoClientProfile), // The "Real Wellness" Differentiator
    platformFee: 0.00, // The "Lower Fees" Differentiator
    totalCost: w.rate // Proof of no markup
  }));

  return c.json(response_data);
});

// POST Booking (Direct Contracting - No Agency Delay)
app.post('/api/bookings', async (c) => {
  const body = await c.req.json();
  
  // Immediate confirmation logic (Differentiator: Flexibility vs HireUp)
  const booking = {
    id: Date.now(),
    clientId: body.clientId,
    workerId: body.workerId,
    status: 'confirmed', // Instantly confirmed, not "pending agency approval"
    timestamp: new Date().toISOString(),
    feeCharged: 0.00 // Explicitly showing $0 fee
  };

  console.log("✅ Booking Created Directly:", booking);

  return c.json({ 
    success: true, 
    message: "Booking confirmed directly with worker.", 
    booking 
  }, 201);
});

export default app;