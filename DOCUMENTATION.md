# VMCRM — Application Documentation

> **Version:** 2.1  
> **Product:** VM Interior CRM for Modular Interior Sales  
> **Stack:** React 18 + Apollo Client (Frontend) · Node.js + Express + Apollo Server + SQLite (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Folder Structure](#6-folder-structure)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [GraphQL API Reference](#9-graphql-api-reference)
10. [Frontend Pages & Routes](#10-frontend-pages--routes)
11. [Lead Lifecycle](#11-lead-lifecycle)
12. [User Roles & Permissions](#12-user-roles--permissions)
13. [File Management](#13-file-management)
14. [Column Customization](#14-column-customization)
15. [Dashboard & Metrics](#15-dashboard--metrics)
16. [Google Calendar Integration](#16-google-calendar-integration)
17. [Testing](#17-testing)
18. [Seed Data & Test Accounts](#18-seed-data--test-accounts)
19. [Deployment Notes](#19-deployment-notes)

---

## 1. Project Overview

VMCRM is a CRM application designed for modular interior sales teams. It manages the full lead lifecycle — from initial enquiry through quotation and deal closure — and provides dashboards, activity tracking, file management, and Google Calendar integration.

### Key Features

- **Lead Management** — Create, track, filter, and update leads with rich detail (designation, contacts, campaign info, property details).
- **Role-Based Access** — Three roles (Owner, Senior Manager, Sales Executive) with hierarchical data visibility.
- **Activity Tracking** — Notes, calls, meetings, status changes, and file uploads logged per lead.
- **Quotation Management** — Version-controlled quotations (Draft → Sent → Accepted/Rejected).
- **File Management** — Upload files to leads with sub-category organisation (Floor Plans, Detailing Files, Reference Images, General).
- **Dashboard** — Pipeline stages, team performance, alerts for stale leads, conversion metrics, source breakdown.
- **Google Calendar** — OAuth 2.0 integration for scheduling meetings with Google Meet links.
- **Column Customization** — Users can choose which columns appear in the leads table, persisted server-side.
- **Advanced Filtering** — Filter leads by status, priority, source, budget range, location, campaign, inactivity days, date range, and more.

---

## 2. Architecture

```
┌────────────────────┐       ┌────────────────────┐
│   React Frontend   │──────▶│   GraphQL API      │
│   (Vite, port 5173)│  HTTP │   (Apollo Server,  │
│   Apollo Client    │◀──────│    port 4000)      │
└────────────────────┘       └──────┬─────────────┘
                                    │
                           ┌────────▼────────┐
                           │   SQLite DB     │
                           │   (WAL mode)    │
                           │   vmcrm.db      │
                           └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Google APIs    │
                           │  (Calendar,     │
                           │   OAuth 2.0)    │
                           └─────────────────┘
```

- **Frontend** → React 18, bundled by Vite, served on port 5173 during development. Vite proxies `/graphql` requests to `http://localhost:4000`.
- **Backend** → Express server with Apollo Server 4 mounted at `/graphql`. All business logic handled via GraphQL resolvers.
- **Database** → SQLite via `better-sqlite3`. Single-file database at `backend/data/vmcrm.db`. WAL mode enabled for concurrent reads. Foreign keys enforced.
- **Auth** → Google OAuth 2.0 sign-in + JWT tokens (7-day expiry). A `devLogin` mutation exists for development/testing.

---

## 3. Prerequisites

| Requirement | Recommended Version |
|---|---|
| Node.js | v20 LTS or v22 LTS |
| npm | v9+ (bundled with Node) |

> **Note:** Node.js v25 may produce a non-fatal `mgt.clearMarks is not a function` error from `perf_hooks`. Use an LTS release for a clean experience.

---

## 4. Getting Started

### 4.1 Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4.2 Database Setup

```bash
cd backend

# Run migrations (creates tables, indexes, columns)
npm run migrate

# Seed sample data (users, leads, contacts, activities, criteria)
npm run seed
```

### 4.3 Start the Application

```bash
# Terminal 1 — backend (port 4000)
cd backend
npm run dev          # nodemon for auto-reload
# or
npm start            # plain node

# Terminal 2 — frontend (port 5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in a browser.

### 4.4 Build for Production

```bash
cd frontend
npm run build        # outputs to frontend/dist/
```

---

## 5. Environment Variables

Create a `.env` file in `backend/`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend server port | `4000` |
| `JWT_SECRET` | Secret key for JWT signing | `'dev-secret'` (fallback) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | — |
| `GOOGLE_REDIRECT_URI` | Redirect URI for Calendar OAuth | `http://localhost:4000/auth/google/callback` |
| `FRONTEND_URL` | Frontend origin for CORS and redirects | `http://localhost:5173` |

---

## 6. Folder Structure

```
Vmtwo/
├── PRD.md                          # Product Requirements Document (v2.1)
├── README.md
├── DOCUMENTATION.md                # This file
│
├── backend/
│   ├── package.json
│   ├── data/
│   │   └── vmcrm.db               # SQLite database (generated)
│   ├── src/
│   │   ├── index.js                # Express + Apollo Server entry point
│   │   ├── auth/
│   │   │   └── auth.js             # JWT generation, verification, middleware
│   │   ├── db/
│   │   │   ├── pool.js             # SQLite connection (WAL mode, FK ON)
│   │   │   ├── migrate.js          # Schema creation & migrations
│   │   │   └── seed.js             # Sample data seeder
│   │   ├── graphql/
│   │   │   ├── typeDefs.js         # GraphQL schema (types, inputs, queries, mutations)
│   │   │   └── resolvers.js        # Query & mutation implementations
│   │   └── services/
│   │       └── googleCalendar.js   # Google Calendar API wrapper
│   └── tests/
│       └── api.test.js             # 122 integration tests
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js              # Vite config (proxy /graphql → :4000)
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   ├── src/
│   │   ├── main.jsx                # React entry point
│   │   ├── App.jsx                 # Router + route definitions
│   │   ├── index.css               # Tailwind base styles
│   │   ├── components/
│   │   │   └── Layout.jsx          # Sidebar + top bar layout
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Auth state (JWT, user, login/logout)
│   │   ├── graphql/
│   │   │   ├── client.js           # Apollo Client instance
│   │   │   └── queries.js          # All GraphQL queries & mutations
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LeadsPage.jsx       # Lead list with filters + column config
│   │   │   ├── LeadDetailPage.jsx  # Single lead view (tabs: activities, quotations, files, details)
│   │   │   ├── CalendarPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── OrgStructurePage.jsx
│   │   └── utils/
│   │       └── constants.js        # Enums, formatters, config maps
```

---

## 7. Database Schema

### 7.1 Entity-Relationship Overview

```
users ─────┐                    qualification_criteria
  │        │                    alert_settings
  │ reports_to                  calendar_events ─── users
  │        │
  ├── leads ── lead_contacts
  │    │
  │    ├── activities
  │    ├── quotations
  │    └── files
```

### 7.2 Tables

#### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| email | TEXT | UNIQUE NOT NULL | Google email |
| name | TEXT | NOT NULL | Display name |
| avatar_url | TEXT | | Google profile photo |
| role | TEXT | NOT NULL, CHECK | `OWNER`, `SENIOR_MANAGER`, `SALES_EXECUTIVE` |
| reports_to | TEXT | FK → users.id | Hierarchy parent |
| is_active | INTEGER | NOT NULL, DEFAULT 1 | Active flag |
| leads_column_preferences | TEXT | | JSON array of visible column keys |
| google_access_token | TEXT | | OAuth access token |
| google_refresh_token | TEXT | | OAuth refresh token |
| google_token_expiry | TEXT | | Token expiry timestamp |
| created_at | TEXT | DEFAULT now | |
| updated_at | TEXT | DEFAULT now | |

#### `leads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| name | TEXT | | Full computed name |
| designation | TEXT | CHECK, DEFAULT 'MR' | `MR`, `MRS`, `DR`, `AR` |
| first_name | TEXT | NOT NULL DEFAULT '' | |
| middle_name | TEXT | | |
| last_name | TEXT | | |
| company | TEXT | | |
| email | TEXT | | |
| phone | TEXT | | |
| status | TEXT | NOT NULL, CHECK | `NEW`, `FOLLOW_UP`, `MQL`, `SQL`, `MUQL`, `QUOTED`, `WON`, `JUNK` |
| priority | TEXT | NOT NULL, CHECK | `P1`, `P2`, `P3` |
| source | TEXT | CHECK | `REPEAT`, `INSTAGRAM`, `FB_ADS`, `GOOGLE_ADS`, `META_ADS`, `WALK_IN`, `REFERRAL`, `WEBSITE_ENQUIRY` |
| campaign_name | TEXT | | Ad campaign name (for paid sources) |
| campaign_active | INTEGER | | 1 = active, 0 = inactive |
| assigned_to | TEXT | FK → users.id | Sales executive handling the lead |
| budget | REAL | | Lead's budget in INR |
| location | TEXT | | Project location |
| delivery_days | INTEGER | | Expected delivery timeline |
| property_in_possession | INTEGER | DEFAULT 0 | 1 = yes, 0 = no |
| expected_handover_month | INTEGER | | Month (1-12) if property not in possession |
| expected_handover_year | INTEGER | | Year if property not in possession |
| current_living_area | TEXT | | Current residence area/locality |
| current_living_city | TEXT | | Current residence city |
| current_living_country | TEXT | | Current residence country |
| notes | TEXT | | Free-text notes |
| created_by | TEXT | FK → users.id | |
| created_at | TEXT | DEFAULT now | |
| updated_at | TEXT | DEFAULT now | |

#### `lead_contacts`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| lead_id | TEXT | FK → leads.id, CASCADE | |
| contact_order | INTEGER | CHECK (2 or 3) | 2nd or 3rd contact |
| name | TEXT | | Contact name |
| phone | TEXT | | |
| email | TEXT | | |
| relationship | TEXT | | e.g. Spouse, Architect, Son |
| created_at | TEXT | | |
| updated_at | TEXT | | |
| | | UNIQUE(lead_id, contact_order) | |

#### `activities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| lead_id | TEXT | FK → leads.id, CASCADE | |
| user_id | TEXT | FK → users.id, CASCADE | |
| type | TEXT | NOT NULL, CHECK | `NOTE`, `CALL`, `MEETING`, `STATUS_CHANGE`, `FILE_UPLOAD`, `QUOTATION`, `TASK` |
| content | TEXT | | Activity description |
| metadata | TEXT | DEFAULT '{}' | JSON for extra data |
| created_at | TEXT | DEFAULT now | |

#### `quotations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| lead_id | TEXT | FK → leads.id, CASCADE | |
| version | INTEGER | NOT NULL DEFAULT 1 | Increment per lead |
| amount | REAL | | Quoted amount |
| file_url | TEXT | | Link to quotation document |
| status | TEXT | CHECK | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED` |
| created_by | TEXT | FK → users.id | |
| created_at | TEXT | | |
| updated_at | TEXT | | |
| | | UNIQUE(lead_id, version) | |

#### `files`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| lead_id | TEXT | FK → leads.id, CASCADE | |
| activity_id | TEXT | FK → activities.id | |
| filename | TEXT | NOT NULL | Original file name |
| file_url | TEXT | NOT NULL | Storage URL |
| file_type | TEXT | | MIME type |
| file_size | INTEGER | | Size in bytes |
| sub_category | TEXT | CHECK, DEFAULT 'GENERAL' | `FLOOR_PLANS`, `DETAILING_FILES`, `REFERENCE_IMAGES`, `GENERAL` |
| uploaded_by | TEXT | FK → users.id | |
| created_at | TEXT | | |

#### `alert_settings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| setting_key | TEXT | UNIQUE NOT NULL | e.g. `no_activity_days_threshold` |
| setting_value | TEXT | NOT NULL | |
| updated_by | TEXT | FK → users.id | |
| updated_at | TEXT | | |

#### `qualification_criteria`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| type | TEXT | NOT NULL, CHECK | `MQL` or `SQL` |
| field | TEXT | NOT NULL | Field to evaluate |
| operator | TEXT | NOT NULL | e.g. `equals`, `greater_than` |
| value | TEXT | NOT NULL | Comparison value |
| is_active | INTEGER | DEFAULT 1 | |
| created_by | TEXT | FK → users.id | |
| created_at | TEXT | | |
| updated_at | TEXT | | |

#### `calendar_events`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK | UUID |
| lead_id | TEXT | FK → leads.id | |
| user_id | TEXT | FK → users.id, CASCADE | |
| google_event_id | TEXT | | Google Calendar event ID |
| title | TEXT | NOT NULL | |
| description | TEXT | | |
| start_time | TEXT | NOT NULL | ISO datetime |
| end_time | TEXT | NOT NULL | ISO datetime |
| meet_link | TEXT | | Google Meet link |
| html_link | TEXT | | Calendar event link |
| attendees | TEXT | | JSON array of emails |
| created_at | TEXT | | |

### 7.3 Indexes

| Index | Table | Column(s) |
|---|---|---|
| idx_leads_status | leads | status |
| idx_leads_assigned_to | leads | assigned_to |
| idx_leads_priority | leads | priority |
| idx_leads_source | leads | source |
| idx_leads_created_at | leads | created_at |
| idx_leads_campaign | leads | campaign_name |
| idx_activities_lead_id | activities | lead_id |
| idx_activities_created_at | activities | created_at |
| idx_quotations_lead_id | quotations | lead_id |
| idx_files_lead_id | files | lead_id |
| idx_files_sub_category | files | sub_category |
| idx_users_role | users | role |
| idx_users_reports_to | users | reports_to |
| idx_lead_contacts_lead | lead_contacts | lead_id |

---

## 8. Authentication & Authorization

### 8.1 Authentication Flow

1. **Google OAuth 2.0** (production) — Frontend sends a Google `idToken` to the `googleLogin` mutation. Backend verifies via Google's `OAuth2Client`, looks up/creates the user, and returns a JWT.
2. **Dev Login** (development/testing) — The `devLogin` mutation accepts an email, finds the matching user, and returns a JWT. **No password required** — for local development only.
3. **JWT** — 7-day expiry, signed with `JWT_SECRET` environment variable (falls back to `'dev-secret'`). Sent as `Authorization: Bearer <token>` header.

### 8.2 Middleware

- `getContextUser(req)` — Extracts and verifies the JWT from the `Authorization` header for every GraphQL request. Returns `{ user }` or `{ user: null }`.
- `requireAuth(context)` — Throws `UNAUTHENTICATED` if no valid user.
- `requireRole(context, roles)` — Throws `FORBIDDEN` if the user's role is not in the allowed list.

### 8.3 Data Visibility Rules

| Role | Can See |
|---|---|
| **OWNER** | All leads, all users |
| **SENIOR_MANAGER** | Leads assigned to themselves or their direct-report SEs |
| **SALES_EXECUTIVE** | Only their own assigned leads |

These rules are enforced at the resolver level in query filters.

---

## 9. GraphQL API Reference

**Endpoint:** `POST /graphql`  
**Auth:** `Authorization: Bearer <jwt>` header

### 9.1 Enums

| Enum | Values |
|---|---|
| `UserRole` | `OWNER`, `SENIOR_MANAGER`, `SALES_EXECUTIVE` |
| `LeadStatus` | `NEW`, `FOLLOW_UP`, `MQL`, `SQL`, `MUQL`, `QUOTED`, `WON`, `JUNK` |
| `LeadPriority` | `P1`, `P2`, `P3` |
| `LeadSource` | `REPEAT`, `INSTAGRAM`, `FB_ADS`, `GOOGLE_ADS`, `META_ADS`, `WALK_IN`, `REFERRAL`, `WEBSITE_ENQUIRY` |
| `Designation` | `MR`, `MRS`, `DR`, `AR` |
| `FileSubCategory` | `FLOOR_PLANS`, `DETAILING_FILES`, `REFERENCE_IMAGES`, `GENERAL` |
| `ActivityType` | `NOTE`, `CALL`, `MEETING`, `STATUS_CHANGE`, `FILE_UPLOAD`, `QUOTATION`, `TASK` |
| `QuotationStatus` | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED` |
| `CriteriaType` | `MQL`, `SQL` |

### 9.2 Queries

#### `me: User`
Returns the authenticated user's profile including `leadsColumnPreferences`.

#### `users: [User!]!`
List all users. Requires `OWNER` or `SENIOR_MANAGER` role.

#### `user(id: ID!): User`
Get a single user by ID.

#### `orgStructure: [User!]!`
Returns the reporting hierarchy tree. Owner only.

#### `leads(filters, limit, offset, sortBy, sortOrder): LeadsConnection!`
Paginated, filterable, sortable lead list. Returns `{ leads, totalCount }`.

**`LeadFilters` input:**

| Field | Type | Description |
|---|---|---|
| status | LeadStatus | Filter by status |
| priority | LeadPriority | Filter by priority |
| source | LeadSource | Filter by source |
| assignedTo | ID | Filter by assigned user |
| search | String | Search name, company, email, phone, location, campaign_name |
| noActivityDays | Int | Leads with no activity in N days |
| budgetMin | Float | Minimum budget |
| budgetMax | Float | Maximum budget |
| location | String | Location substring match |
| propertyInPossession | Boolean | Filter by property status |
| campaignName | String | Campaign name substring match |
| campaignActive | Boolean | Filter by campaign status |
| createdAfter | String | ISO date lower bound |
| createdBefore | String | ISO date upper bound |

#### `lead(id: ID!): Lead`
Get a single lead with all related data (contacts, activities, quotations, files).

#### `activities(leadId: ID!, limit, offset): [Activity!]!`
Activity history for a lead, newest first.

#### `quotations(leadId: ID!): [Quotation!]!`
All quotation versions for a lead.

#### `files(leadId: ID!, subCategory: FileSubCategory): [File!]!`
Files for a lead, optionally filtered by sub-category.

#### `dashboardMetrics: DashboardMetrics!`
Aggregated metrics: pipeline stages, team performance, alerts, conversion rates, source breakdown, weekly trends. Owner/SM only.

#### `alertSettings: [AlertSetting!]!`
All alert configuration settings. Owner only.

#### `qualificationCriteria(type: CriteriaType): [QualificationCriteria!]!`
MQL/SQL criteria definitions. Owner only.

#### `calendarAuthUrl: CalendarAuthUrl!`
Generates a Google OAuth consent URL for calendar access.

#### `calendarEvents(limit: Int): [CalendarEvent!]!`
Returns calendar events for the authenticated user.

#### `isCalendarConnected: Boolean!`
Whether the user has linked their Google Calendar.

### 9.3 Mutations

#### Auth

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `googleLogin` | `idToken: String!` | `AuthPayload` | Verify Google token, create/find user, return JWT |
| `devLogin` | `email: String!` | `AuthPayload` | Dev-only login by email |

#### Users

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `createUser` | `email, name, role, reportsTo` | `User` | Add a new team member (Owner only) |
| `updateUser` | `id, input: UpdateUserInput` | `User` | Update user profile/role |
| `updateOrgStructure` | `userId, reportsTo, role` | `User` | Change reporting hierarchy (Owner only) |

#### Leads

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `createLead` | `input: CreateLeadInput` | `Lead` | Create a new lead with all v2.1 fields + contacts |
| `updateLead` | `id, input: UpdateLeadInput` | `Lead` | Update any lead fields; contacts are upserted |
| `deleteLead` | `id: ID!` | `Boolean` | Delete a lead (Owner only) |
| `bulkUpdateLeadStatus` | `leadIds, status` | `[Lead]` | Batch status change |

#### Activities

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `createActivity` | `input: CreateActivityInput` | `Activity` | Log a note, call, meeting, etc. |

#### Quotations

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `createQuotation` | `input: CreateQuotationInput` | `Quotation` | Auto-increments version per lead |
| `updateQuotation` | `id, input: UpdateQuotationInput` | `Quotation` | Update amount, URL, or status |

#### Files

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `uploadFile` | `input: UploadFileInput` | `File` | Upload file metadata with sub-category |
| `deleteFile` | `id: ID!` | `Boolean` | Delete a file record |

#### Settings

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `updateAlertSettings` | `settings: [AlertSettingInput!]!` | `[AlertSetting]` | Owner-only settings update |
| `saveQualificationCriteria` | `criteria, type` | `[QualificationCriteria]` | Replace MQL/SQL criteria (Owner only) |

#### Column Preferences

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `saveColumnPreferences` | `columns: [String!]!` | `User` | Persist leads table column selection |

#### Calendar

| Mutation | Arguments | Returns | Description |
|---|---|---|---|
| `createCalendarEvent` | `input: CreateCalendarEventInput` | `CalendarEvent` | Schedule via Google Calendar API |
| `deleteCalendarEvent` | `eventId: ID!` | `Boolean` | Delete from Google Calendar |

---

## 10. Frontend Pages & Routes

| Route | Component | Roles | Description |
|---|---|---|---|
| `/login` | `LoginPage` | Public | Google sign-in + dev login |
| `/dashboard` | `DashboardPage` | OWNER, SENIOR_MANAGER | Pipeline, team performance, alerts, metrics |
| `/leads` | `LeadsPage` | All authenticated | Leads table with filters, search, column customization |
| `/leads/:id` | `LeadDetailPage` | All authenticated | Lead details, tabs: Activities, Quotations, Files, Lead Details |
| `/calendar` | `CalendarPage` | All authenticated | Google Calendar integration |
| `/settings` | `SettingsPage` | OWNER | Alert thresholds, MQL/SQL criteria |
| `/settings/org` | `OrgStructurePage` | OWNER | Org hierarchy management |

### Route Protection

All routes except `/login` are wrapped in a `PrivateRoute` component that:
1. Checks for a valid JWT token in auth context.
2. Verifies the user's role matches the route's allowed roles.
3. Redirects to `/login` if unauthenticated.
4. Redirects to `/leads` if role is insufficient (e.g. SE accessing `/dashboard`).

---

## 11. Lead Lifecycle

```
NEW → FOLLOW_UP → MQL → SQL → QUOTED → WON
                    ↓
                  MUQL (Marketing Unqualified Lead)
                    
Any status → JUNK (disqualified)
```

### Status Definitions

| Status | Meaning |
|---|---|
| **NEW** | Fresh lead, not yet contacted |
| **FOLLOW_UP** | Initial contact made, requires follow-up |
| **MQL** | Marketing Qualified Lead — meets marketing criteria |
| **SQL** | Sales Qualified Lead — meets sales criteria |
| **MUQL** | Marketing Unqualified Lead — doesn't meet marketing criteria |
| **QUOTED** | Quotation sent to the lead |
| **WON** | Deal closed successfully |
| **JUNK** | Disqualified / not a valid lead |

### Priority Levels

| Priority | Meaning | Colour |
|---|---|---|
| **P1** | High priority — immediate action | Red |
| **P2** | Medium priority | Yellow |
| **P3** | Low priority | Green |

---

## 12. User Roles & Permissions

### Role Hierarchy

```
OWNER
 ├── SENIOR_MANAGER (SM1)
 │    ├── SALES_EXECUTIVE (SE1)
 │    └── SALES_EXECUTIVE (SE2)
 └── SENIOR_MANAGER (SM2)
      ├── SALES_EXECUTIVE (SE3)
      └── SALES_EXECUTIVE (SE4)
```

### Permission Matrix

| Action | Owner | Senior Manager | Sales Executive |
|---|---|---|---|
| View dashboard | ✅ | ✅ | ❌ |
| View all leads | ✅ | Team leads only | Own leads only |
| Create leads | ✅ | ✅ | ✅ |
| Update leads | ✅ | Team leads only | Own leads only |
| Delete leads | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Manage org structure | ✅ | ❌ | ❌ |
| Configure alert settings | ✅ | ❌ | ❌ |
| Configure MQL/SQL criteria | ✅ | ❌ | ❌ |
| Upload/delete files | ✅ | ✅ | ✅ |
| Create activities | ✅ | ✅ | ✅ |
| Manage quotations | ✅ | ✅ | ✅ |
| Column preferences | ✅ | ✅ | ✅ |
| Calendar integration | ✅ | ✅ | ✅ |

---

## 13. File Management

### Sub-Categories

| Sub-Category | Description |
|---|---|
| `FLOOR_PLANS` | Architectural floor plan documents |
| `DETAILING_FILES` | Technical specification & detailing files |
| `REFERENCE_IMAGES` | Design reference images / mood boards |
| `GENERAL` | All other files |

### How It Works

1. Navigate to a lead's detail page → **Files** tab.
2. Filter by sub-category using the tab bar.
3. Upload: Select file, choose sub-category, submit. Creates a file record and logs a `FILE_UPLOAD` activity.
4. Delete: Removes the file record.

> **Note:** File storage is URL-based. The current implementation stores file metadata (name, URL, type, size, sub-category). Actual file binary storage must be handled by an external storage service (e.g. S3, Cloudinary).

---

## 14. Column Customization

On the **Leads** page, users can toggle which columns are visible in the leads table:

### Available Columns

| Key | Label |
|---|---|
| `name` | Name |
| `company` | Company |
| `status` | Status |
| `priority` | Priority |
| `source` | Source |
| `budget` | Budget |
| `location` | Location |
| `assignedTo` | Assigned To |
| `phone` | Phone |
| `email` | Email |
| `deliveryDays` | Delivery Days |
| `campaignName` | Campaign |
| `propertyInPossession` | Property in Possession |
| `createdAt` | Created |
| `updatedAt` | Last Updated |

Preferences are persisted server-side via the `saveColumnPreferences` mutation and stored as a JSON array in the user's `leads_column_preferences` column.

---

## 15. Dashboard & Metrics

Available to **Owner** and **Senior Manager** roles.

### Sections

1. **Summary Cards** — Total leads, new leads, MQL, SQL, quoted, won counts, booked orders value.
2. **Pipeline Stages** — Bar chart of leads per status.
3. **Team Performance** — Table showing each SE's leads by status.
4. **Alerts** — Leads with no activity beyond the threshold (configurable in Settings).
5. **Performance Metrics** (Owner view):
   - Conversion rate, average deal size, average time to close.
   - Weekly trend chart (new leads, won leads, revenue).
   - Source breakdown (count, won count, revenue per source).
   - Team ranking (total leads, won, conversion rate, revenue).

---

## 16. Google Calendar Integration

### Setup

1. Create a Google Cloud project with Calendar API enabled.
2. Set up OAuth 2.0 credentials (web application type).
3. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `.env`.
4. Add `http://localhost:4000/auth/google/callback` to authorised redirect URIs.

### Flow

1. User navigates to the Calendar page.
2. If not connected, clicks "Connect Google Calendar" → redirected to Google consent.
3. Google redirects back to `/auth/google/callback` with an auth code.
4. Backend exchanges code for tokens, stores them in the user record.
5. User can now create events with Google Meet links.

### API

- `calendarAuthUrl` — Get the OAuth consent URL.
- `isCalendarConnected` — Check connection status.
- `calendarEvents(limit)` — List events.
- `createCalendarEvent(input)` — Create event (with optional Google Meet).
- `deleteCalendarEvent(eventId)` — Delete event from Google Calendar.

---

## 17. Testing

### Test Suite

The test suite is located at `backend/tests/api.test.js` and uses Node's built-in `node:test` and `node:assert` modules.

### Running Tests

```bash
cd backend
node --test tests/api.test.js
```

### Coverage: 122 Tests

| Category | Test Count | What's Covered |
|---|---|---|
| **Auth** | ~8 | devLogin success, missing email, invalid email, token generation |
| **User CRUD** | ~10 | List users, get by ID, create, update, role enforcement |
| **Lead CRUD** | ~15 | Create with all v2.1 fields, update, delete, validation |
| **Lead Filters** | ~18 | Status, priority, source, search, noActivityDays, budget range, location, campaign, property, date range, sort, pagination |
| **Contacts** | ~6 | Create leads with contacts, update contacts, contact order validation |
| **Activities** | ~8 | Create note/call/meeting, list by lead, validation |
| **Quotations** | ~8 | Create, auto-version, update status, list by lead |
| **Files** | ~10 | Upload with sub-category, filter by sub-category, delete, validation |
| **Column Preferences** | ~4 | Save, retrieve, persist across queries |
| **Dashboard** | ~6 | Metrics, pipeline, team performance, alerts |
| **Edge Cases** | ~10 | Non-existent IDs, unauthorized access, invalid inputs, SE visibility |
| **Org Structure** | ~5 | Update reporting, role changes, hierarchy queries |

### Test Strategy

- Tests use `devLogin` to authenticate as different roles (Owner, SM, SE).
- Each test category creates its own test data to avoid interference.
- Tests run against the live database — run `npm run migrate && npm run seed` before testing.

---

## 18. Seed Data & Test Accounts

After running `npm run seed`, the following accounts are available:

| Email | Name | Role | Reports To |
|---|---|---|---|
| `owner@moducraft.com` | Rajesh Kumar | OWNER | — |
| `sm1@moducraft.com` | Rahul Sharma | SENIOR_MANAGER | Owner |
| `sm2@moducraft.com` | Amit Sharma | SENIOR_MANAGER | Owner |
| `se1@moducraft.com` | Priya Singh | SALES_EXECUTIVE | SM1 |
| `se2@moducraft.com` | Amit Verma | SALES_EXECUTIVE | SM1 |
| `se3@moducraft.com` | Rahul Sharma Jr | SALES_EXECUTIVE | SM2 |
| `se4@moducraft.com` | Bons Verma | SALES_EXECUTIVE | SM2 |

### Dev Login Example

```graphql
mutation {
  devLogin(email: "owner@moducraft.com") {
    token
    user { id name role }
  }
}
```

Use the returned `token` in the `Authorization: Bearer <token>` header for subsequent requests.

### Seeded Data

- **11 leads** across various statuses (NEW, FOLLOW_UP, MQL, SQL, QUOTED) with full v2.1 fields.
- **4 additional contacts** on selected leads (Spouse, Architect, Son, Engineer relationships).
- **22 activities** (2 per lead — NOTE + CALL).
- **4 qualification criteria** (2 MQL, 2 SQL).

---

## 19. Deployment Notes

### Production Considerations

1. **JWT Secret** — Set a strong, random `JWT_SECRET` in production. Never use `'dev-secret'`.
2. **Remove devLogin** — The `devLogin` mutation should be disabled or removed in production environments.
3. **File Storage** — Implement actual file upload to a cloud service (S3, GCS, Cloudinary). Currently only metadata is stored.
4. **Database** — SQLite is suitable for small teams. For larger deployments, migrate to PostgreSQL. The schema is compatible.
5. **HTTPS** — Serve behind a reverse proxy (Nginx, Caddy) with TLS termination.
6. **CORS** — Configure `FRONTEND_URL` to the exact production domain.
7. **Static Files** — Build the frontend (`npm run build`) and serve `frontend/dist/` via the reverse proxy or a CDN.
8. **Google OAuth** — Update authorised redirect URIs and JavaScript origins for the production domain.
9. **Rate Limiting** — Add rate limiting middleware (e.g. `express-rate-limit`) for the GraphQL endpoint.
10. **Logging** — Add structured logging (Winston, Pino) for production observability.

---

*Generated for VMCRM v2.1*
