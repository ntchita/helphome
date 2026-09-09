import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['client', 'worker', 'admin'] }).notNull(),
  // NEW: Subscription Tier (The "Lower Fee" Engine)
  subscriptionTier: text('subscription_tier', { enum: ['free', 'basic', 'premium'] }).default('free'),
  subscriptionExpiry: text('subscription_expiry'),
  createdAt: text('created_at').default(new Date().toISOString()),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  fullName: text('full_name'),
  bio: text('bio'),
  // NEW: Interests for Wellness Matching (The "Wellness Focus" Engine)
  interests: text('interests'), // JSON string: ["dogs", "cooking", "music"]
  skills: text('skills'), 
  hourlyRate: real('hourly_rate'),
  wellnessGoals: text('wellness_goals'),
  avatarUrl: text('avatar_url'),
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
