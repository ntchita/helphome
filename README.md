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
- Wrangler CLI (`npm install -g wrangler`)

### Installation
```bash
npm install
npx wrangler login
```

### Run Locally
```bash
# Start backend API
npm run dev

# Start frontend (in another terminal)
npm run build
npm run preview
```

### Database Setup
```bash
npx wrangler d1 create helphome-db
# Update wrangler.toml with the new database_id
npm run db:generate
npm run db:push
```

## User Stories
See [docs/USER_STORIES.md](docs/USER_STORIES.md) for detailed requirements.

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

## License
MIT
