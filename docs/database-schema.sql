-- Helphome Platform Database Schema (reference for post-pilot migration)
-- Target: Cloudflare D1 / SQLite — portable to PostgreSQL (Azure) with minimal changes
-- NOTE: the pilot currently runs on in-memory stores inside src/api/index.ts.
--       This schema is the destination when the stakeholders' infrastructure decision lands.
PRAGMA foreign_keys = ON;

-- ==========================================
-- 1. USERS (base authentication table)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                      -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,              -- bcrypt
  role TEXT NOT NULL CHECK (role IN ('client', 'worker', 'manager', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 2. CLIENT PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ndis_number TEXT,
  plan_manager_type TEXT CHECK (plan_manager_type IN ('self_managed', 'plan_managed', 'ndia_managed')),
  interests TEXT,                           -- JSON array, drives wellness matching
  support_goals TEXT,                       -- JSON array of goals
  preferred_worker_traits TEXT,             -- JSON array of traits
  wellness_check_frequency INTEGER DEFAULT 7,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. STAFF PROFILES (workers & managers)
-- ==========================================
CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bio TEXT,
  skills TEXT,                              -- JSON array
  interests TEXT,                           -- JSON array, drives wellness matching
  hourly_rate REAL NOT NULL,
  capacity_booked INTEGER DEFAULT 0,        -- hours booked this week
  capacity_total INTEGER DEFAULT 30,        -- hard cap: 85% utilisation rule
  availability TEXT,                        -- JSON schedule / human-readable string
  wwcc_number TEXT,
  wwcc_expiry DATE,
  police_check_expiry DATE,
  first_aid_expiry DATE,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rating_avg REAL DEFAULT 0.0,
  total_bookings INTEGER DEFAULT 0,
  last_checkin DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. BOOKINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  service_type TEXT,
  hourly_rate REAL NOT NULL,
  total_amount REAL NOT NULL,
  match_score INTEGER,                      -- wellness match % at request time
  matched_on TEXT,                          -- JSON array of shared interests
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'disputed')),
  declined_reason TEXT,                     -- never penalises the worker
  location_address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES client_profiles(id),
  FOREIGN KEY (worker_id) REFERENCES staff_profiles(id)
);

-- ==========================================
-- 5. SESSION LOGS (post-service reporting)
-- ==========================================
CREATE TABLE IF NOT EXISTS session_logs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  check_in_time DATETIME,
  check_out_time DATETIME,
  activities_completed TEXT,                -- JSON array
  outcomes_achieved TEXT,
  challenges_notes TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (worker_id) REFERENCES staff_profiles(id)
);

-- ==========================================
-- 6. WELLNESS LOGS (confidential by design)
--    worker types: 'load' | 'supported' | 'balance'
--    client types: 'mood' | 'goals' | 'satisfaction'
--    Managers see derived status (Thriving/Steady/At risk), never raw answers.
-- ==========================================
CREATE TABLE IF NOT EXISTS wellness_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('worker', 'client')),
  log_type TEXT NOT NULL,
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- 7. WELFARE CHATS (manager follow-ups on flagged workers)
-- ==========================================
CREATE TABLE IF NOT EXISTS welfare_chats (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  scheduled_at DATETIME,
  outcome_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES staff_profiles(id),
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- ==========================================
-- 8. DOCUMENTS (compliance & plans)
-- ==========================================
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,                   -- 'wwcc', 'police_check', 'ndis_plan', etc.
  file_url TEXT NOT NULL,                   -- Cloudflare R2
  expiry_date DATE,
  is_verified BOOLEAN DEFAULT FALSE,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- 9. SIGNUP LEADS (three-door registration intake)
-- ==========================================
CREATE TABLE IF NOT EXISTS signup_leads (
  id TEXT PRIMARY KEY,
  door TEXT NOT NULL CHECK (door IN ('client', 'worker', 'coordinator')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  org_name TEXT,
  interests TEXT,                           -- JSON array (client door)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 10. REVIEWS (post-pilot)
-- ==========================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- ==========================================
-- 11. PAYMENTS (Stripe transaction records)
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'AUD',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_staff_verification ON staff_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON wellness_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_door ON signup_leads(door);