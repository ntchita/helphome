import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('/*', cors());

// Database type
type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

// Auth middleware (optional for public routes)
const authMiddleware = jwt({ secret: process.env.JWT_SECRET || 'dev-secret' });

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// AUTH ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (c: any) => {
  const db = drizzle(c.env.DB);
  const { email, password, role } = await c.req.json();
  
  // TODO: Hash password with bcrypt
  const passwordHash = password; // Placeholder
  
  const userId = crypto.randomUUID();
  
  try {
    await db.insert(schema.users).values({
      id: userId,
      email,
      passwordHash,
      role,
    }).run();
    
    // Create profile based on role
    if (role === 'client') {
      await db.insert(schema.clientProfiles).values({
        id: crypto.randomUUID(),
        userId,
      }).run();
    } else if (role === 'worker') {
      await db.insert(schema.staffProfiles).values({
        id: crypto.randomUUID(),
        userId,
        verificationStatus: 'pending',
      }).run();
    }
    
    return c.json({ 
      success: true, 
      message: 'Registration successful',
      userId 
    });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ success: false, message: 'Email already exists' }, 400);
    }
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Login
app.post('/api/auth/login', async (c: any) => {
  const db = drizzle(c.env.DB);
  const { email, password } = await c.req.json();
  
  const user = await db.select().from(schema.users).where(
    (users: any) => users.email === email
  ).get();
  
  if (!user || user.passwordHash !== password) {
    return c.json({ success: false, message: 'Invalid credentials' }, 401);
  }
  
  // Update last login
  await db.update(schema.users)
    .set({ lastLogin: new Date().toISOString() })
    .where((users: any) => users.id === user.id);
  
  // TODO: Generate JWT token
  const token = 'mock-jwt-token';
  
  return c.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    }
  });
});

// ==========================================
// WORKER ROUTES
// ==========================================

// Get all workers (with filters)
app.get('/api/workers', async (c: any) => {
  const db = drizzle(c.env.DB);
  const { skills, minRate, maxRate } = c.req.query();
  
  let query = db.select().from(schema.staffProfiles);
  
  // TODO: Add filtering logic
  
  const workers = await query.all();
  
  return c.json({ workers });
});

// Get worker by ID
app.get('/api/workers/:id', async (c: any) => {
  const db = drizzle(c.env.DB);
  const { id } = c.req.param();
  
  const worker = await db.select().from(schema.staffProfiles)
    .where((profiles: any) => profiles.id === id)
    .get();
  
  if (!worker) {
    return c.json({ success: false, message: 'Worker not found' }, 404);
  }
  
  return c.json({ worker });
});

// ==========================================
// BOOKING ROUTES
// ==========================================

// Create booking
app.post('/api/bookings', authMiddleware, async (c: any) => {
  const db = drizzle(c.env.DB);
  const { clientId, workerId, startTime, endTime, serviceType, hourlyRate, locationAddress, notes } = await c.req.json();
  
  const totalAmount = hourlyRate * ((new Date(endTime).getTime() - new Date(startTime).getTime()) / 3600000);
  const bookingId = crypto.randomUUID();
  
  await db.insert(schema.bookings).values({
    id: bookingId,
    clientId,
    workerId,
    startTime,
    endTime,
    serviceType,
    hourlyRate,
    totalAmount,
    status: 'pending',
    locationAddress,
    notes,
  }).run();
  
  return c.json({
    success: true,
    message: 'Booking request sent',
    bookingId
  });
});

// Get bookings for user
app.get('/api/bookings', authMiddleware, async (c: any) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('jwtPayload').userId; // From JWT
  const role = c.get('jwtPayload').role;
  
  let bookings;
  if (role === 'client') {
    const clientProfile = await db.select().from(schema.clientProfiles)
      .where((profiles: any) => profiles.userId === userId)
      .get();
    
    bookings = await db.select().from(schema.bookings)
      .where((bookings: any) => bookings.clientId === clientProfile.id)
      .all();
  } else if (role === 'worker') {
    const staffProfile = await db.select().from(schema.staffProfiles)
      .where((profiles: any) => profiles.userId === userId)
      .get();
    
    bookings = await db.select().from(schema.bookings)
      .where((bookings: any) => bookings.workerId === staffProfile.id)
      .all();
  }
  
  return c.json({ bookings });
});

// Accept/Decline booking
app.patch('/api/bookings/:id/status', authMiddleware, async (c: any) => {
  const db = drizzle(c.env.DB);
  const { id } = c.req.param();
  const { status } = await c.req.json();
  
  if (!['confirmed', 'cancelled'].includes(status)) {
    return c.json({ success: false, message: 'Invalid status' }, 400);
  }
  
  await db.update(schema.bookings)
    .set({ status })
    .where((bookings: any) => bookings.id === id);
  
  return c.json({ success: true, message: `Booking ${status}` });
});

// ==========================================
// WELLNESS ROUTES
// ==========================================

// Log wellness check-in
app.post('/api/wellness', authMiddleware, async (c: any) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('jwtPayload').userId;
  const { logType, moodScore, goalProgress, notes } = await c.req.json();
  
  await db.insert(schema.wellnessLogs).values({
    id: crypto.randomUUID(),
    userId,
    logType,
    moodScore,
    goalProgress,
    notes,
  }).run();
  
  return c.json({ success: true, message: 'Wellness logged' });
});

// Get wellness history
app.get('/api/wellness', authMiddleware, async (c: any) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('jwtPayload').userId;
  
  const logs = await db.select().from(schema.wellnessLogs)
    .where((logs: any) => logs.userId === userId)
    .all();
  
  return c.json({ logs });
});

export default app;
