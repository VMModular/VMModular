# VMTwo

for sales teams.

## Tech Stack

- **Frontend:** React 18, Tailwind CSS, Apollo Client, Recharts, React Router
- **Backend:** Node.js, Express, Apollo Server (GraphQL)
- **Database:** PostgreSQL
- **Auth:** Google OAuth 2.0 / Dev login

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ running locally
- Create database: `createdb vmcrm`

### 1. Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and Google OAuth credentials

# Run migrations
npm run migrate

# Seed demo data
npm run seed

# Start server
npm run dev
```

Backend runs at `http://localhost:4000/graphql`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 3. Login

Use the demo accounts on the login page:
- **Owner/CEO:** owner@moducraft.com
- **Senior Sales Manager:** sm1@moducraft.com
- **Sales Executive:** se1@moducraft.com

## Project Structure

```
├── PRD.md                  # Product Requirements Document
├── backend/
│   ├── src/
│   │   ├── index.js         # Express + Apollo Server entry
│   │   ├── auth/auth.js     # JWT auth middleware
│   │   ├── db/
│   │   │   ├── pool.js      # PostgreSQL connection pool
│   │   │   ├── migrate.js   # Database migrations
│   │   │   └── seed.js      # Demo data seeder
│   │   └── graphql/
│   │       ├── typeDefs.js   # GraphQL schema
│   │       └── resolvers.js  # GraphQL resolvers
│   ├── .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   ├── components/
    │   │   └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── graphql/
    │   │   ├── client.js
    │   │   └── queries.js
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── LeadsPage.jsx
    │   │   ├── LeadDetailPage.jsx
    │   │   ├── SettingsPage.jsx
    │   │   └── OrgStructurePage.jsx
    │   └── utils/
    │       └── constants.js
    ├── index.html
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vite.config.js
    └── package.json
```

## Features

- **Lead Management** — Create, list, filter, and track leads with status pipeline
- **Activity Timeline** — Notes, calls, meetings, status changes tracked per lead
- **Quotation Management** — Initial + revised quotations with version tracking
- **Management Dashboard** — Alerts, pipeline funnel, team performance charts
- **MQL/SQL Criteria** — Configurable qualification rules (budget, location, delivery)
- **Alert Configuration** — Configurable alert thresholds
- **Org Structure** — Drag-and-drop hierarchy management
- **Role-Based Access** — Owner, Senior Manager, Sales Executive with scoped views

## Google OAuth Setup (Production)

1. Create a project in Google Cloud Console
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Set the redirect URI to `http://localhost:4000/auth/google/callback`
5. Add client ID and secret to `.env`
