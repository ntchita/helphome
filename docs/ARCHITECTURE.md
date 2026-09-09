# Helphome Technical Architecture

## System Overview
Helphome uses a Cloudflare-native serverless architecture to minimize costs and maximize scalability.



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
