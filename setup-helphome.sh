#!/bin/bash

# Helphome Platform Setup Script
# This script creates the entire project structure, files, and initializes Git

set -e # Exit on error

echo "🚀 Starting Helphome Platform Setup..."

# 1. Create Directory Structure
echo "📂 Creating directory structure..."
mkdir -p src/api
mkdir -p src/db
mkdir -p src/frontend/src/components
mkdir -p src/frontend/src/pages
mkdir -p src/frontend/public
mkdir -p docs
mkdir -p tests

# 2. Create package.json
echo "📦 Creating package.json..."
cat > package.json <<EOF
{
  "name": "helphome-platform",
  "version": "1.0.0",
  "description": "Helphome NDIS Support Platform MVP",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev src/api/index.ts",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:push": "wrangler d1 execute helphome-db --local --file=./drizzle/meta/0000_snapshot.json",
    "test": "vitest"
  },
  "dependencies": {
    "hono": "^4.3.0",
    "drizzle-orm": "^0.30.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "drizzle-kit": "^0.20.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0",
    "wrangler": "^3.30.0",
    "vitest": "^1.3.0"
  }
}
EOF

# 3. Create tsconfig.json
echo "⚙️ Creating tsconfig.json..."
cat > tsconfig.json <<EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
EOF

# 4. Create wrangler.toml
echo "☁️ Creating wrangler.toml..."
cat > wrangler.toml <<EOF
name = "helphome-api"
main = "src/api/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"
JWT_SECRET = "change-this-in-production"

[[d1_databases]]
binding = "DB"
database_name = "helphome-db"
database_id = "your-database-id-here"
EOF

# 5. Create vite.config.ts
echo "⚡ Creating vite.config.ts..."
cat > vite.config.ts <<EOF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
EOF

# 6. Create Drizzle Config
echo "🗄️ Creating drizzle.config.ts..."
cat > drizzle.config.ts <<EOF
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: './wrangler.toml',
    dbName: 'helphome-db',
  },
} satisfies Config;
EOF

# 7. Create Database Schema
echo "💾 Creating database schema..."
cat > src/db/schema.ts <<EOF
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['client', 'worker', 'admin'] }).notNull(),
  createdAt: text('created_at').default(new Date().toISOString()),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  fullName: text('full_name'),
  bio: text('bio'),
  skills: text('skills'), // JSON string of skills
  hourlyRate: real('hourly_rate'),
  wellnessGoals: text('wellness_goals'), // JSON string
  location: text('location'),
  verified: integer('verified', { mode: 'boolean' }).default(false),
});

export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey(),
  clientId: integer('client_id').references(() => users.id),
  workerId: integer('worker_id').references(() => users.id),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'completed', 'cancelled'] }).default('pending'),
  totalAmount: real('total_amount'),
  notes: text('notes'),
  createdAt: text('created_at').default(new Date().toISOString()),
});

export const sessionLogs = sqliteTable('session_logs', {
  id: integer('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id),
  workerId: integer('worker_id').references(() => users.id),
  checkInTime: text('check_in_time'),
  checkOutTime: text('check_out_time'),
  activitiesCompleted: text('activities_completed'), // JSON string
});

export const wellnessLogs = sqliteTable('wellness_logs', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  moodScore: integer('mood_score'), // 1-10
  notes: text('notes'),
  loggedAt: text('logged_at').default(new Date().toISOString()),
});

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  docType: text('doc_type').notNull(), // 'ndis_plan', 'police_check', 'qualification'
  fileUrl: text('file_url').notNull(),
  uploadedAt: text('uploaded_at').default(new Date().toISOString()),
  verified: integer('verified', { mode: 'boolean' }).default(false),
});

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id),
  reviewerId: integer('reviewer_id').references(() => users.id),
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment'),
  createdAt: text('created_at').default(new Date().toISOString()),
});
EOF

# 8. Create DB Connection Mock (for local dev)
echo "🔌 Creating db connection..."
cat > src/db/connection.ts <<EOF
// In production, this connects to Cloudflare D1
// For local dev, we'll use a mock or better-sqlite3 if needed
import { drizzle } from 'drizzle-orm/d1';

export function getDb(env: any) {
  return drizzle(env.DB);
}
EOF

# 9. Create Backend API (Hono)
echo "🔌 Creating backend API..."
cat > src/api/index.ts <<EOF
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
EOF

# 10. Create Frontend Index HTML
echo "🌐 Creating frontend HTML..."
cat > src/frontend/index.html <<EOF
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Helphome Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# 11. Create Frontend Main Entry
echo "⚛️ Creating React entry point..."
cat > src/frontend/src/main.tsx <<EOF
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
EOF

# 12. Create Frontend CSS
echo "🎨 Creating basic CSS..."
cat > src/frontend/src/index.css <<EOF
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
  margin: 0 auto;
  text-align: center;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
EOF

# 13. Create Main App Component
echo "⚛️ Creating App component..."
cat > src/frontend/src/App.tsx <<EOF
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'

function App() {
  return (
    <div className="app">
      <nav style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
        <Link to="/login" style={{ marginRight: '1rem' }}>Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  )
}

export default App
EOF

# 14. Create Page Components
echo "📄 Creating page components..."

# Home Page
cat > src/frontend/src/pages/Home.tsx <<EOF
export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to Helphome</h1>
      <p>Your trusted NDIS support platform connecting clients with quality workers.</p>
      <div style={{ marginTop: '2rem' }}>
        <h3>Why Choose Helphome?</h3>
        <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
          <li>Lower fees than competitors</li>
          <li>Holistic wellness integration</li>
          <li>Rigorous safety checks</li>
          <li>Community-focused approach</li>
        </ul>
      </div>
    </div>
  )
}
EOF

# Login Page
cat > src/frontend/src/pages/Login.tsx <<EOF
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert(\`Login attempt: \${email}\`)
    // TODO: Implement actual auth
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '0.5rem' }}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '0.5rem' }}
          required
        />
        <button type="submit">Sign In</button>
      </form>
    </div>
  )
}
EOF

# Dashboard Page
cat > src/frontend/src/pages/Dashboard.tsx <<EOF
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    // TODO: Fetch real data from API
    setBookings([
      { id: 1, worker: 'Jane Doe', date: '2024-03-20', status: 'Confirmed' },
      { id: 2, worker: 'John Smith', date: '2024-03-22', status: 'Pending' }
    ])
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Dashboard</h2>
      <h3>Upcoming Bookings</h3>
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
          {bookings.map((b: any) => (
            <li key={b.id} style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
              <strong>{b.worker}</strong> - {b.date} <span style={{ color: b.status === 'Confirmed' ? 'green' : 'orange' }}>({b.status})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
EOF

# 15. Create Documentation Files
echo "📚 Creating documentation..."

# README
cat > README.md <<EOF
# Helphome Platform

## Overview
Helphome is a hybrid NDIS support platform connecting self-managed clients with qualified support workers. We offer lower fees and better service than competitors like Mable, HireUp, and LikeFamily.

## Features
- **User Onboarding**: Secure registration for clients and workers
- **Smart Matching**: Find workers by skills, location, and interests
- **Booking Management**: Easy scheduling and payment processing
- **Wellness Integration**: Track goals and mood after sessions
- **Document Verification**: Upload and verify NDIS plans, police checks

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Hono.js (Cloudflare Workers)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Deployment**: Cloudflare Pages/Workers

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI (\`npm install -g wrangler\`)

### Installation
\`\`\`bash
npm install
npx wrangler login
\`\`\`

### Run Locally
\`\`\`bash
# Start backend API
npm run dev

# Start frontend (in another terminal)
npm run build
npm run preview
\`\`\`

### Database Setup
\`\`\`bash
npx wrangler d1 create helphome-db
# Update wrangler.toml with the new database_id
npm run db:generate
npm run db:push
\`\`\`

## User Stories
See [docs/USER_STORIES.md](docs/USER_STORIES.md) for detailed requirements.

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

## License
MIT
EOF

# User Stories
cat > docs/USER_STORIES.md <<EOF
# Helphome User Stories

## Epic 1: Onboarding & Verification
- **US1.1**: As a Client, I want to register with my email and NDIS number so I can access the platform. *(Must)*
- **US1.2**: As a Worker, I want to upload my police check and qualifications so I can get verified. *(Must)*
- **US1.3**: As an Admin, I want to review and approve worker documents so only safe workers are on the platform. *(Must)*

## Epic 2: Search & Matching
- **US2.1**: As a Client, I want to search workers by skill (e.g., "Personal Care") and location. *(Must)*
- **US2.2**: As a Client, I want to see worker profiles with ratings and bios. *(Should)*
- **US2.3**: As a Client, I want to filter workers by availability and hourly rate. *(Could)*

## Epic 3: Booking & Payments
- **US3.1**: As a Client, I want to book a session for a specific date/time. *(Must)*
- **US3.2**: As a Client, I want to pay securely via credit card or NDIS plan funds. *(Must)*
- **US3.3**: As a Worker, I want to receive booking notifications and accept/decline requests. *(Must)*

## Epic 4: Service Delivery
- **US4.1**: As a Worker, I want to check-in and check-out of sessions digitally. *(Must)*
- **US4.2**: As a Client, I want to view session logs and activities completed. *(Should)*
- **US4.3**: As a Worker, I want to add notes about the session for future reference. *(Could)*

## Epic 5: Wellness & Goals
- **US5.1**: As a Client, I want to log my mood (1-10) after each session. *(Must)*
- **US5.2**: As a Client, I want to set wellness goals (e.g., "Go to gym twice a week"). *(Should)*
- **US5.3**: As a Worker, I want to see my client's goals before the session starts. *(Should)*

## Epic 6: Reviews & Community
- **US6.1**: As a Client, I want to leave a rating and review for a worker. *(Must)*
- **US6.2**: As a Worker, I want to see my average rating and feedback. *(Should)*
- **US6.3**: As a User, I want to join community forums or groups. *(Won't - MVP)*
EOF

# Architecture
cat > docs/ARCHITECTURE.md <<EOF
# Helphome Technical Architecture

## System Overview
Helphome uses a Cloudflare-native serverless architecture to minimize costs and maximize scalability.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React     │ ────▶│   Hono API   │ ────▶│ Cloudflare  │
│  Frontend   │      │ (Workers)    │      │   D1 (DB)   │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐      ┌──────────────┐
│  Cloudflare │      │   External   │
│   Pages     │      │   Services   │
│             │      │ (Payments)   │
└─────────────┘      └──────────────┘
```

## Components

### 1. Frontend (React + Vite)
- Hosted on Cloudflare Pages
- Role-based routing (Client, Worker, Admin)
- Responsive design for mobile/desktop
- State management via React Context

### 2. Backend (Hono.js)
- Runs on Cloudflare Workers (Edge)
- RESTful API endpoints
- JWT Authentication middleware
- Input validation with Zod (future)

### 3. Database (Cloudflare D1)
- Serverless SQLite
- Schema managed by Drizzle ORM
- Tables: users, profiles, bookings, session_logs, wellness_logs, documents, reviews

### 4. External Integrations
- **Payments**: Stripe Connect (planned)
- **Documents**: Cloudflare R2 for file storage (planned)
- **Notifications**: Email via Resend or SendGrid (planned)

## Security
- Password hashing with bcrypt
- JWT for session management
- CORS policies
- Input sanitization
- Role-based access control (RBAC)

## Deployment Strategy
- **Phase 1 (MVP)**: Cloudflare Workers + D1 (Free tier)
- **Phase 2**: Add R2 for documents, Stripe for payments
- **Phase 3**: Scale to Azure/AWS if needed (portable code)
EOF

# 16. Create .gitignore
echo "🙈 Creating .gitignore..."
cat > .gitignore <<EOF
node_modules
dist
.wrangler
.local
*.log
.env
.DS_Store
coverage
EOF

# 17. Initialize Git
echo "🌿 Initializing Git repository..."
git init
git add .
git commit -m "feat: Initial Helphome MVP setup with full stack architecture"

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. cd into the project directory if you aren't already"
echo "2. Run 'npm install' to install dependencies"
echo "3. Run 'npx wrangler login' to authenticate with Cloudflare"
echo "4. Run 'npx wrangler d1 create helphome-db' to create your database"
echo "5. Update 'wrangler.toml' with your new database ID"
echo "6. Run 'npm run dev' to start the local server"
echo ""
echo "Happy coding! 🚀"
