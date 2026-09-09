import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { getDb } from '../db/connection';
import * as schema from '../db/schema';

const app = new Hono();

// Middleware
app.use('/*', cors());
// app.use('/api/*', jwt({ secret: process.env.JWT_SECRET || 'dev-secret' }));

// Health Check
app.get('/', (c) => c.json({ status: 'ok', message: 'Helphome API Running' }));

// Auth Endpoints (Mock)
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  // TODO: Implement actual registration with password hashing
  return c.json({ message: 'Registration successful', user: { email: body.email, role: body.role } }, 201);
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  // TODO: Implement actual login with JWT generation
  return c.json({ message: 'Login successful', token: 'mock-jwt-token' });
});

// Worker Endpoints
app.get('/api/workers', async (c) => {
  // TODO: Query DB for workers
  const mockWorkers = [
    { id: 1, name: "Jane Doe", skills: ["Personal Care", "Community Access"], rate: 45, verified: true },
    { id: 2, name: "John Smith", skills: ["Transport", "Household Tasks"], rate: 40, verified: true },
    { id: 3, name: "Sarah Lee", skills: ["Specialist Disability"], rate: 55, verified: false }
  ];
  return c.json(mockWorkers);
});

app.get('/api/workers/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: Query DB for specific worker
  return c.json({ id, name: "Jane Doe", skills: ["Personal Care"], rate: 45, bio: "Experienced support worker." });
});

// Booking Endpoints
app.post('/api/bookings', async (c) => {
  const body = await c.req.json();
  // TODO: Save to DB
  return c.json({ message: 'Booking created', booking: { ...body, id: Date.now(), status: 'pending' } }, 201);
});

app.get('/api/bookings', async (c) => {
  // TODO: Query DB for user's bookings
  return c.json([
    { id: 101, worker: "Jane Doe", date: "2024-03-20", status: "confirmed" },
    { id: 102, worker: "John Smith", date: "2024-03-22", status: "pending" }
  ]);
});

// Wellness Endpoints
app.post('/api/wellness/log', async (c) => {
  const body = await c.req.json();
  // TODO: Save wellness log to DB
  return c.json({ message: 'Wellness logged', data: body }, 201);
});

app.get('/api/wellness/history', async (c) => {
  // TODO: Query wellness history
  return c.json([
    { date: "2024-03-01", mood: 8, note: "Great day!" },
    { date: "2024-03-05", mood: 6, note: "Feeling okay." }
  ]);
});

export default app;
