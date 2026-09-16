import {
  pgTable, pgEnum, uuid, text, timestamp, boolean, integer, real, date, jsonb,
} from 'drizzle-orm/pg-core';

// ---------- enums ----------
export const roleEnum = pgEnum('user_role', ['client', 'worker', 'coordinator', 'admin']);
export const doorEnum = pgEnum('lead_door', ['client', 'worker', 'coordinator']);
export const fundingEnum = pgEnum('funding_stream', ['private', 'ndis', 'hcp']);
export const planMgrEnum = pgEnum('plan_manager_type', ['self_managed', 'plan_managed', 'ndia_managed']);
export const docTypeEnum = pgEnum('doc_type', ['police_check', 'wwcc', 'drivers_licence', 'qualification', 'insurance']);
export const jobStatusEnum = pgEnum('job_status', ['open', 'filled', 'cancelled']);
export const shiftStatusEnum = pgEnum('shift_status', ['requested', 'offered', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled']);
export const approvalEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);
export const audienceEnum = pgEnum('wellness_audience', ['worker', 'client']);
export const commsTypeEnum = pgEnum('comms_type', ['call', 'message']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['contractor_tax_invoice', 'client_invoice']);
export const claimRouteEnum = pgEnum('claim_route', ['plan_manager', 'direct', 'private']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'submitted', 'approved', 'paid']);
export const verificationEnum = pgEnum('verification_status', ['pending', 'verified', 'rejected']);
export const syncDirEnum = pgEnum('sync_direction', ['pull', 'push']);
export const syncOutcomeEnum = pgEnum('sync_outcome', ['success', 'failed', 'skipped']);

const tz = { withTimezone: true };

// ---------- tenants (coordinator orgs; HelpHome = #1) ----------
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  registeredProvider: boolean('registered_provider').notNull().default(false),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- users (admin = platform super-admin, tenantId null) ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  entraObjectId: text('entra_object_id'),
  role: roleEnum('role').notNull(),
  fullName: text('full_name'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  lastLogin: timestamp('last_login', tz),
});

// ---------- client profiles (PII for commission reporting; DOB never displayed) ----------
export const clientProfiles = pgTable('client_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  fullName: text('full_name').notNull(),
  dob: date('dob').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  ndisNumber: text('ndis_number'),
  fundingStream: fundingEnum('funding_stream'),
  planManagerType: planMgrEnum('plan_manager_type'),
  planManagerName: text('plan_manager_name'),
  interests: jsonb('interests').$type<string[]>(),
  supportGoals: jsonb('support_goals').$type<string[]>(),
});

// ---------- worker profiles (contractors, ABN; consent-gated display) ----------
export const workerProfiles = pgTable('worker_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  abn: text('abn'),
  bio: text('bio'),
  skills: jsonb('skills').$type<string[]>(),
  interests: jsonb('interests').$type<string[]>(),
  hourlyRate: real('hourly_rate').notNull(),
  capacityBooked: integer('capacity_booked').notNull().default(0),
  capacityTotal: integer('capacity_total').notNull().default(30), // 85% cap
  availability: jsonb('availability'),
  consentToDisplay: boolean('consent_to_display').notNull().default(false),
  verificationStatus: verificationEnum('verification_status').notNull().default('pending'),
  ratingAvg: real('rating_avg').notNull().default(0),
  totalBookings: integer('total_bookings').notNull().default(0),
});

// ---------- worker documents (Privacy Act: issue + expiry) ----------
export const workerDocuments = pgTable('worker_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id, { onDelete: 'cascade' }),
  docType: docTypeEnum('doc_type').notNull(),
  fileUrl: text('file_url').notNull(),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  isVerified: boolean('is_verified').notNull().default(false),
  uploadedAt: timestamp('uploaded_at', tz).notNull().defaultNow(),
});

// ---------- job postings (coordinator advertises; workers accept) ----------
export const jobPostings = pgTable('job_postings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  coordinatorId: uuid('coordinator_id').notNull().references(() => users.id),
  serviceType: text('service_type'),
  startTime: timestamp('start_time', tz).notNull(),
  endTime: timestamp('end_time', tz).notNull(),
  location: text('location'),
  rate: real('rate'),
  status: jobStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- shifts (availability-first matching) ----------
export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  clientId: uuid('client_id').notNull().references(() => clientProfiles.id),
  workerId: uuid('worker_id').references(() => workerProfiles.id),
  jobPostId: uuid('job_post_id').references(() => jobPostings.id),
  startTime: timestamp('start_time', tz).notNull(),
  endTime: timestamp('end_time', tz).notNull(),
  serviceType: text('service_type'),
  status: shiftStatusEnum('status').notNull().default('requested'),
  declinedReason: text('declined_reason'), // never penalises worker
  matchScore: integer('match_score'),
  matchedOn: jsonb('matched_on').$type<string[]>(),
  locationAddress: text('location_address'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- progress notes (legal evidence; immutable once approved) ----------
export const progressNotes = pgTable('progress_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id),
  body: text('body').notNull(),
  attachments: jsonb('attachments').$type<string[]>(),
  approvalStatus: approvalEnum('approval_status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', tz),
  submittedAt: timestamp('submitted_at', tz).notNull().defaultNow(),
});

// ---------- wellness logs (confidential; derived status only) ----------
export const wellnessLogs = pgTable('wellness_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  audience: audienceEnum('audience').notNull(),
  logType: text('log_type').notNull(), // worker: load|supported|balance · client: mood|goals|satisfaction
  score: integer('score'),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- welfare chats ----------
export const welfareChats = pgTable('welfare_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  workerId: uuid('worker_id').notNull().references(() => workerProfiles.id),
  coordinatorId: uuid('coordinator_id').notNull().references(() => users.id),
  scheduledAt: timestamp('scheduled_at', tz),
  outcomeNotes: text('outcome_notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- comms events (masked in-app call/message) ----------
export const commsEvents = pgTable('comms_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  shiftId: uuid('shift_id').references(() => shifts.id),
  initiatedBy: uuid('initiated_by').notNull().references(() => users.id),
  type: commsTypeEnum('type').notNull(),
  maskedNumber: text('masked_number'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- invoices (contractor tax invoices / client invoices) ----------
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id),
  progressNoteId: uuid('progress_note_id').references(() => progressNotes.id),
  type: invoiceTypeEnum('type').notNull(),
  amount: real('amount').notNull(),
  claimRoute: claimRouteEnum('claim_route'),
  planManagerName: text('plan_manager_name'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- signup leads / coordinator waitlist ----------
export const signupLeads = pgTable('signup_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  door: doorEnum('door').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  orgName: text('org_name'),
  interests: jsonb('interests').$type<string[]>(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

// ---------- VisualCare sync audit ----------
export const visualcareSyncLog = pgTable('visualcare_sync_log', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  direction: syncDirEnum('direction'),
  entityType: text('entity_type'),
  outcome: syncOutcomeEnum('outcome'),
  errorMessage: text('error_message'),
  processedAt: timestamp('processed_at', tz).notNull().defaultNow(),
});