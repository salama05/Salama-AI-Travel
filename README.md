 ✈️ Salama Travel — AI Travel Agent SaaS

> An intelligent flight booking platform powered by Google Gemini AI, Redis Vector Search, and Supabase — built with Next.js 16 App Router.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-green?style=flat-square&logo=supabase)
![Redis](https://img.shields.io/badge/Redis-Cloud-red?style=flat-square&logo=redis)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss)

---

## 🌟 Overview

Salama Travel is a full-stack SaaS travel platform where users can search for flights, make bookings, receive e-tickets with QR codes, and interact with an intelligent AI agent — all in one seamless experience.

The AI agent understands natural language queries like *"I want to fly from LAX to HND"*, searches the vector database for matching flights, remembers user preferences across sessions, and responds with grounded, accurate results.

---

## ✨ Features

### 🤖 AI Agent
- Natural language flight search powered by Google Gemini 2.5 Flash
- Redis Vector Search for semantic flight matching (RediSearch + embeddings)
- Semantic Cache (LangCache) to avoid redundant Gemini API calls
- Agent Memory (long-term & session) to remember user preferences and conversation history
- Tool-calling architecture with search_flights, get_user_bookings, get_user_tickets

### 🛫 Flight Booking
- Browse and search flights with real-time availability
- Seat selection with concurrency protection (database-level unique constraints)
- Prevents double-booking when two users attempt the same seat simultaneously

### 💳 Payments
- PayTabs payment gateway integration (test mode supported)
- Secure checkout flow with webhook handler for payment confirmation

### 🎫 E-Tickets
- Auto-generated e-tickets upon successful booking
- QR Code encoding a secure verification URL
- Automated QR scan verification: status transitions from active → boarded
- Boarding pass UI with Booking ID, Date, Status Badge

### 🔐 Authentication & Security
- Supabase Auth with Row-Level Security (RLS) policies
- Admin role system with protected /admin/support dashboard
- Service role key for server-side admin operations
- JWT-based session management

### 🛠️ Admin Dashboard
- View and manage all user support tickets
- Update ticket status (open → resolved / closed)
- Redis vector index sync when ticket status changes

### 🔄 Real-time Sync
- Supabase Database Webhooks → Redis sync pipeline
- Any new flight added in Supabase automatically indexed in Redis via sync-hook
- init-index endpoint for bulk backfill of existing flights

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Vector DB | Redis Cloud (RediSearch) |
| Semantic Cache | Redis LangCache |
| Agent Memory | Redis Agent Memory |
| AI Model | Google Gemini 2.5 Flash |
| Embeddings | gemini-embedding-001 |
| Payments | PayTabs |
| Styling | Tailwind CSS + Shadcn UI |
| Tunnel (dev) | ngrok |

---

## 📁 Project Structure

`
salama-travel/
├── app/
│   ├── api/
│   │   ├── agent/          # AI Agent route (Gemini + tools)
│   │   └── redis/
│   │       ├── init-index/ # Bulk backfill flights → Redis
│   │       ├── sync-hook/  # Supabase webhook → Redis sync
│   │       └── status/     # Redis connection status
│   ├── admin/
│   │   └── support/        # Protected admin dashboard
│   ├── dashboard/
│   │   └── tickets/        # User e-tickets page
 │   └── chat/               # AI Agent chat interface
├── lib/
│   ├── vector-search.ts    # Redis vector index + flight indexing
│   ├── langcache.ts        # Semantic cache (LangCache)
│   ├── agent-memory.ts     # Long-term & session memory
│   └── entities.ts         # Data mappers
├── actions/                # Server actions
└── components/             # UI components

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Redis Cloud account (with LangCache + Agent Memory services)
- Google AI API key (Gemini)
- PayTabs account
- ngrok (for local webhook development)

### 1. Clone the repository

bash
git clone https://github.com/salama05/Salama-AI-Travel.git
cd salama-travel
npm install

### 2. Environment Variables

Create a `.env.local` file in the root directory:

env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis Cloud
REDIS_URL=your_redis_connection_string
REDIS_SYNC_WEBHOOK_SECRET=your_webhook_secret

# Redis LangCache
LANGCACHE_HOST=https://aws-us-east-1.langcache.redis.io
LANGCACHE_CACHE_ID=your_cache_id
LANGCACHE_API_KEY=your_langcache_api_key

# Redis Agent Memory
AGENT_MEMORY_HOST=https://gcp-us-east4.memory.redis.io
AGENT_MEMORY_STORE_ID=your_store_id
AGENT_MEMORY_API_KEY=your_memory_api_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# PayTabs
PAYTABS_PROFILE_ID=your_profile_id
PAYTABS_SERVER_KEY=your_server_key
PAYTABS_BASE_URL=https://secure-egypt.paytabs.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

### 3. Database Setup

Run the SQL migrations in **Supabase SQL Editor**:

sql
-- Enable RLS on tables
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookings
CREATE POLICY "Users view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Grant admin role (replace with your email)
UPDATE auth.users SET raw_app_meta_data =
  raw_app_meta_data || '{"role": "admin"}'
  WHERE email = 'your-email@example.com';

### 4. Initialize Redis Vector Index

After setting up your environment, bootstrap the flight index:

bash
curl.exe -X POST http://localhost:3000/api/redis/init-index \
  -H "Authorization: Bearer YOUR_REDIS_SYNC_WEBHOOK_SECRET"

### 5. Configure Supabase Webhook

In **Supabase Dashboard → Database → Webhooks**, create a webhook:
- **Table:** `flights`
- **Events:** `INSERT`, `UPDATE`, `DELETE`
- **URL:** `https://your-ngrok-url.ngrok-free.dev/api/redis/sync-hook`
- **Headers:**
  - `Content-Type: application/json`
  - `x-webhook-secret: YOUR_SECRET`
  - `ngrok-skip-browser-warning: true` *(for local dev only)*

### 6. Run the development server

bash
npm run dev

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Admin Access

After granting yourself the admin role in the database, sign out and sign back in to get a fresh JWT, then navigate to `/admin/support`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agent` | AI agent chat |
| `POST` | `/api/redis/init-index` | Bulk index all flights |
| `POST` | `/api/redis/sync-hook` | Supabase → Redis sync |
| `GET`  | `/api/redis/status` | Redis connection health |

---

## 🧠 AI Agent Architecture

User Message
     │
     ▼
[LangCache Check] ──HIT──▶ Return cached response
     │ MISS
     ▼
[Load Session Memory] ◀── Redis Agent Memory
     │
     ▼
[Gemini 2.5 Flash] ──Tool Call──▶ [search_flights / get_bookings]
     │                                      │
     │                               [Redis Vector Search]
     │                                      │
     ▼                                      ▼
[Grounded Final Answer] ◀────── Tool Results
     │
     ▼
[Store in LangCache + Session Memory]
     │
     ▼
Return Response
`

---

## 🛡️ Security
- All admin routes protected with role-based middleware
- RLS policies enforce data isolation between users
- Service role key never exposed to the client
- Webhook endpoints secured with secret tokens
- QR code verification uses secure unique ticket IDs

---

## 👤 Author

Abdessalam Benkorichi (Salama)
- GitHub: [@salama05](https://github.com/salama05)
- Portfolio: [www.salamaweb.me](https://salamaweb.me)

---

## 📄 License

This project is licensed under the MIT License.
