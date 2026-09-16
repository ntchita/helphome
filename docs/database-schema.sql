-- HelpWork (working title) — multi-tenant platform schema
-- Pilot reference (SQLite-flavoured); portable to Azure PostgreSQL AU East.
PRAGMA foreign_keys = ON;

-- 1. TENANTS (coordinator organisations; HelpHome = tenant #1)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  registered_provider BOOLEAN DEFAULT FALSE,   -- false = claims via plan manager
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (roles: client | worker | coordinator | admin; admin = platform super-admin, tenant NULL)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                          -- external users; staff use Entra SSO
  entra_object_id TEXT,                        -- M365 SSO + MFA
  role TEXT NOT NULL CHECK (role IN ('client','worker','coordinator','admin')),
  full_name TEXT,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 3. CLIENT PROFILES (PII required for Aged Care / NDIS commission reporting; DOB never displayed)
CREATE TABLE IF NOT EXISTS client_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  ndis_number TEXT,
  funding_stream TEXT CHECK (funding_stream IN ('private','ndis','hcp')),
  plan_manager_type TEXT CHECK (plan_manager_type IN ('self_managed','plan_managed','ndia_managed')),
  plan_manager_name TEXT,                      -- e.g. PlanCare, Australian Unity, Trilogy
  interests TEXT,                              -- JSON array
  support_goals TEXT,                          -- JSON array
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 4. WORKER PROFILES (independent contractors, ABN; profile hidden unless consent given)
CREATE TABLE IF NOT EXISTS worker_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  abn TEXT,
  bio TEXT,
  skills TEXT,                                 -- JSON array
  interests TEXT,                              -- JSON array
  hourly_rate REAL NOT NULL,
  capacity_booked INTEGER DEFAULT 0,
  capacity_total INTEGER DEFAULT 30,           -- 85% utilisation cap
  availability TEXT,                           -- JSON schedule
  consent_to_display BOOLEAN DEFAULT FALSE,    -- Privacy: explicit consent to show profile
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  rating_avg REAL DEFAULT 0.0,
  total_bookings INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 5. WORKER DOCUMENTS (Privacy Act: secure storage, issue + expiry dates)
CREATE TABLE IF NOT EXISTS worker_documents (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('police_check','wwcc','drivers_licence','qualification','insurance')),
  file_url TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  is_verified BOOLEAN DEFAULT FALSE,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
);

-- 6. JOB POSTINGS (coordinator advertises a shift; workers accept)
CREATE TABLE IF NOT EXISTS job_postings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  coordinator_id TEXT NOT NULL,
  service_type TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  location TEXT,
  rate REAL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (coordinator_id) REFERENCES users(id)
);

-- 7. SHIFTS (availability-first matching; no profile browsing without consent)
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  worker_id TEXT,
  job_post_id TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  service_type TEXT,
  status TEXT DEFAULT 'requested'
    CHECK (status IN ('requested','offered','accepted','in_progress','completed','declined','cancelled')),
  declined_reason TEXT,                        -- never penalises the worker
  match_score INTEGER,
  matched_on TEXT,                             -- JSON array
  location_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (client_id) REFERENCES client_profiles(id),
  FOREIGN KEY (worker_id) REFERENCES worker_profiles(id),
  FOREIGN KEY (job_post_id) REFERENCES job_postings(id)
);

-- 8. PROGRESS NOTES (legal proof of service; immutable once approved; attached to invoice)
CREATE TABLE IF NOT EXISTS progress_notes (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments TEXT,                            -- JSON array of file URLs
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by TEXT,
  approved_at DATETIME,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id),
  FOREIGN KEY (worker_id) REFERENCES worker_profiles(id)
);

-- 9. WELLNESS LOGS (confidential; coordinators see derived status only)
CREATE TABLE IF NOT EXISTS wellness_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('worker','client')),
  log_type TEXT NOT NULL,
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 10. WELFARE CHATS (coordinator follow-up on flagged workers)
CREATE TABLE IF NOT EXISTS welfare_chats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  coordinator_id TEXT NOT NULL,
  scheduled_at DATETIME,
  outcome_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES worker_profiles(id),
  FOREIGN KEY (coordinator_id) REFERENCES users(id)
);

-- 11. COMMS EVENTS (in-app call/message with masked numbers)
CREATE TABLE IF NOT EXISTS comms_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shift_id TEXT,
  initiated_by TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call','message')),
  masked_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiated_by) REFERENCES users(id)
);

-- 12. INVOICES (contractor tax invoices + client invoices; claim route per tenant registration)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  progress_note_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('contractor_tax_invoice','client_invoice')),
  amount REAL NOT NULL,
  claim_route TEXT CHECK (claim_route IN ('plan_manager','direct','private')),
  plan_manager_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id),
  FOREIGN KEY (progress_note_id) REFERENCES progress_notes(id)
);

-- 13. SIGNUP LEADS / WAITLIST (three doors + coordinator waitlist)
CREATE TABLE IF NOT EXISTS signup_leads (
  id TEXT PRIMARY KEY,
  door TEXT NOT NULL CHECK (door IN ('client','worker','coordinator')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  org_name TEXT,
  interests TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. VISUALCARE SYNC LOG (per tenant audit)
CREATE TABLE IF NOT EXISTS visualcare_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('pull','push')),
  entity_type TEXT,
  outcome TEXT CHECK (outcome IN ('success','failed','skipped')),
  error_message TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_status ON shifts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_approval ON progress_notes(approval_status);
CREATE INDEX IF NOT EXISTS idx_docs_expiry ON worker_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_wellness_user ON wellness_logs(user_id, created_at);