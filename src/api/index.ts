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

// Mock Client Profiles (In real app, fetch from DB based on clientId)
const clientProfiles: Record<string, any> = {
  "user-123": { interests: ["sports", "fitness"], needs: ["Transport"] },
  // Default fallback if no ID provided or ID not found
  "default": { interests: ["dogs", "music", "outdoors"], needs: ["Personal Care", "Companionship"] }
};

app.get('/', (c) => c.json({ message: 'HelpHome API Active', version: '1.0.0' }));

// GET Workers with REAL Wellness Matching Scores
app.get('/api/workers', async (c) => {
  const profile = clientProfiles["default"]; // Default for list view
  const ranked = rankWorkers(workers, profile);
  
  const response_data = ranked.map(w => ({
    ...w,
    wellnessMatchScore: calculateWellnessMatch(w, profile),
	wellnessMatch: calculateWellnessMatch(w, profile),
    platformFee: 0.00,
    totalCost: w.rate
  }));

  return c.json(response_data);
});

// POST Booking (Direct Contracting - No Agency Delay)
app.post('/api/bookings', async (c) => {
  try {
    const body = await c.req.json();
    const { workerId, clientId } = body;

    if (!workerId) {
      return c.json({ success: false, message: "Worker ID required" }, 400);
    }

    // 1. Find the worker
    const worker = workers.find(w => w.id === workerId);
    if (!worker) {
      return c.json({ success: false, message: "Worker not found" }, 404);
    }

    // 2. Get Client Profile (Mocked lookup)
    const profile = (clientId && clientProfiles[clientId]) ? clientProfiles[clientId] : clientProfiles["default"];

    // 3. Calculate REAL Match Score using your matcher utility
    const matchScore = calculateWellnessMatch(worker, profile);

    // 4. Create Booking Record
    const booking = {
      id: Date.now(),
      clientId: clientId || "guest",
      workerId: worker.id,
      workerName: worker.name,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      feeCharged: 0.00,
      matchScore: matchScore // Return the calculated score
    };

    console.log("✅ Booking Created Directly:", booking);

    return c.json({ 
      success: true, 
      message: `Booking confirmed with ${worker.name}`, 
      booking,
      matchScore,
      status: 'confirmed'
    }, 201);

  } catch (error) {
    console.error("❌ Booking Error:", error);
    return c.json({ success: false, message: "Internal server error" }, 500);
  }
});

// --- DEMO SAFETY STUBS (respond gracefully; real DB wiring is post-Monday) ---
app.post('/api/wellness', async (c) => {
  const body = await c.req.json();
  console.log('✅ Wellness check recorded:', body);
  return c.json({ success: true, message: 'Wellness check recorded' }, 201);
});

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  console.log('✅ Registration (demo):', body.email);
  return c.json({ success: true, message: 'Registered (demo)' }, 201);
});

export default app;