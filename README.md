# VMModular CRM

A premium, modular CRM designed for high-performance sales teams.

## 🐳 Docker Setup (Recommended)

The easiest way to get started is using the integrated Docker environment. This handles the database, backend, and frontend automatically.

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 2. One-Shot Setup
Run the automated setup script for your operating system. This will configure environment variables, start the containers, run migrations, and seed demo data.

**Linux / macOS:**
```bash
chmod +x setup.sh startup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

### 3. Reset Environment
To completely wipe the database and re-initialize with fresh demo data:

**Linux / macOS:**
```bash
./setup.sh --reset
```

**Windows (PowerShell):**
```powershell
.\setup.ps1 -Reset
```

## 🚀 NPM Shortcuts (Easiest)

If you have Node installed on your host, you can use these shortcuts:

| Action | Shortcut | Background Command |
| :--- | :--- | :--- |
| **Initial Setup** | `npm run setup` / `:win` | `./setup.sh` / `.\setup.ps1` |
| **Full Reset** | `npm run reset` / `:win` | `./setup.sh --reset` / `.\setup.ps1 -Reset` |
| **Quick Start** | `npm run startup` / `:win` | `./startup.sh` / `.\startup.ps1` |
| **Full Up** | `npm run up` | `docker compose up -d` |
| **Stop & Remove** | `npm run down` | `docker compose down` |
| **Pause App** | `npm run stop` | `docker compose stop` |
| **Resume App** | `npm run start` | `docker compose start` |
| **View Logs** | `npm run logs` | `docker compose logs -f` |
| **Run Migrations** | `npm run migrate` | `docker compose exec backend npm run migrate` |
| **Seed Data** | `npm run seed` | `docker compose exec backend npm run seed` |

---

## 🛠 Common Operations

### Start, Stop & Pause
- **Full Start:** `npm run up` (or `docker compose up -d`) — Recreates/starts all containers.
- **Stop & Remove:** `npm run down` (or `docker compose down`) — Stops and removes containers, networks, and images (volumes are preserved unless `-v` is used).
- **Pause (Stop):** `npm run stop` (or `docker compose stop`) — Stops containers but keeps them intact. Use this for a quick "just stop".
- **Resume (Start):** `npm run start` (or `docker compose start`) — Resumes previously stopped containers.

### Maintenance
- **Check Logs:**
  ```bash
  npm run logs
  ```
- **Manual Seeding:**
  ```bash
  npm run seed
  ```
- **Database Migrations:**
  ```bash
  npm run migrate
  ```

---

## 🌐 Accessing the Application

Once the setup is complete, you can access the following endpoints:

| Component | URL |
| :--- | :--- |
| **Frontend UI** | [http://localhost](http://localhost) |
| **GraphQL API** | [http://localhost/graphql](http://localhost/graphql) |
| **Health Check** | [http://localhost/health](http://localhost/health) |

### 🔑 Default Credentials
Use these accounts to test different role-based access:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Owner/CEO** | `owner@moducraft.com` | `password123` |
| **Sales Manager** | `sm1@moducraft.com` | `password123` |
| **Sales Executive** | `se1@moducraft.com` | `password123` |

---

## 🏗 Project Structure

```
├── backend/                # Node.js + Apollo Server
│   ├── src/db/             # Migrations & Seeding logic
│   └── src/graphql/        # Schema & Resolvers
├── frontend/               # React 18 + Vite + Tailwind
├── docker-compose.yml      # Container orchestration
├── setup.sh                # Main installation & reset script
└── startup.sh              # Lightweight start script
```

---

## ✨ Features

- **Lead Management** — Create, list, filter, and track leads with status pipeline
- **Activity Timeline** — Notes, calls, meetings, status changes tracked per lead
- **Quotation Management** — Initial + revised quotations with version tracking
- **Management Dashboard** — Alerts, pipeline funnel, team performance charts
- **MQL/SQL Criteria** — Configurable qualification rules (budget, location, delivery)
- **Alert Configuration** — Configurable alert thresholds
- **Org Structure** — Drag-and-drop hierarchy management
- **Role-Based Access** — Owner, Senior Manager, Sales Executive with scoped views

---

## 💻 Manual Setup (Legacy/Development)

If you prefer to run the application without Docker:

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Configure your DB URL
npm run migrate
npm run seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Google OAuth Setup (Optional)
1. Create a project in Google Cloud Console
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Set the redirect URI to `http://localhost:4000/auth/google/callback`
5. Add client ID and secret to `.env`
