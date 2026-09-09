-- Helphome Platform Database Schema (Cloudflare D1 / SQLite)
-- Designed for portability to PostgreSQL/MySQL in Phase 3

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ==========================================
-- 1. USERS (Base Authentication Table)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- UUID
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client', 'worker', 'admin')),
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
    support_goals TEXT, -- JSON array of goals
    preferred_worker_traits TEXT, -- JSON array of traits
    wellness_check_frequency INTEGER DEFAULT 7, -- Days between checks
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. STAFF PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS staff_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bio TEXT,
    skills TEXT, -- JSON array of skills
    hourly_rate_min REAL,
    hourly_rate_max REAL,
    availability_calendar TEXT, -- JSON schedule
    wwcc_number TEXT,
    wwcc_expiry DATE,
    police_check_expiry DATE,
    first_aid_expiry DATE,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    rating_avg REAL DEFAULT 0.0,
    total_bookings INTEGER DEFAULT 0,
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
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'disputed')),
    location_address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES client_profiles(id),
    FOREIGN KEY (worker_id) REFERENCES staff_profiles(id)
);

-- ==========================================
-- 5. SESSION LOGS (Post-Service Reporting)
-- ==========================================
CREATE TABLE IF NOT EXISTS session_logs (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    activities_completed TEXT, -- JSON array
    outcomes_achieved TEXT,
    challenges_notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (worker_id) REFERENCES staff_profiles(id)
);

-- ==========================================
-- 6. WELLNESS LOGS (Burnout Prevention & Goal Tracking)
-- ==========================================
CREATE TABLE IF NOT EXISTS wellness_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_type TEXT CHECK (log_type IN ('worker_mood', 'client_goal')),
    mood_score INTEGER, -- 1-10 for workers
    goal_progress TEXT, -- Text description for clients
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- 7. DOCUMENTS (Compliance & Plans)
-- ==========================================
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    doc_type TEXT NOT NULL, -- 'wwcc', 'police_check', 'ndis_plan', etc.
    file_url TEXT NOT NULL,
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- 8. PAYMENTS (Stripe Transaction Records)
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'AUD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_staff_verification ON staff_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
