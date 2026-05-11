# ModuCraft Furniture CRM — Product Requirements Document

**Version:** 2.7  
**Date:** May 11, 2026  
**Product Name:** VM CRM (ModuCraft Furniture CRM)  
**Platform:** Web Application  

---

## 1. Overview

VM CRM is a web-based Customer Relationship Management and lead management application purpose-built for a modular furniture factory. It tracks the complete sales lead lifecycle — from initial contact through qualification to becoming a customer — and equips sales teams with tools for effective follow-up, pipeline management, and performance tracking.

---

## 2. Goals & Objectives

| Goal | Measure |
|------|---------|
| Centralize lead tracking | 100% of inbound leads captured with source attribution |
| Reduce lead response time | Alerts for unattended leads within configurable days |
| Improve sales qualification | Configurable MQL/SQL criteria with budget, location, delivery thresholds |
| Increase management visibility | Real-time dashboard with pipeline, KPIs, performance metrics, and severity-based alerts |
| Enforce consistent follow-up | Activity timeline, call/meeting scheduling via Google Calendar & Meet integration |
| Streamline team management | Org structure with inline role editing, activation/deactivation, and table view |

---

## 3. User Roles & Permissions

### 3.1 Role Hierarchy

```
Owner / CEO
├── Senior Sales Manager (SM)
│   ├── Sales Executive 1 (SE)
│   ├── Sales Executive 2 (SE)
│   └── ...
├── Senior Sales Manager (SND)
│   ├── Sales Executive 3 (SE)
│   └── Sales Executive 4 (SE)
└── ...
```

### 3.2 Permission Matrix

| Capability | Owner/CEO | Senior Sales Manager | Sales Executive |
|------------|-----------|---------------------|-----------------|
| View own leads | ✅ | ✅ | ✅ |
| View team leads | ✅ | ✅ (direct reports) | ❌ |
| View all leads | ✅ | ❌ | ❌ |
| Create/edit leads | ✅ | ✅ | ✅ (own only) |
| Add notes/calls/meetings | ✅ | ✅ | ✅ (own leads) |
| Manage quotations | ✅ | ✅ | ✅ (own leads) |
| Management dashboard | ✅ | ✅ (team scope) | ❌ |
| Admin settings | ✅ | ❌ | ❌ |
| Org structure management | ✅ | ❌ | ❌ |
| MQL/SQL criteria config | ✅ | ❌ | ❌ |
| Alert rules configuration | ✅ | ❌ | ❌ |
| Assign/reassign leads | ✅ | ✅ (within team) | ❌ |
| Full database backup | ✅ | ❌ | ❌ |
| Export leads (CSV/Excel) | ✅ | ✅ | ❌ |
| Bulk import leads | ✅ | ✅ | ❌ |

---

## 4. Authentication

- **Method:** Google OAuth 2.0
- **Flow:** User clicks "Login with Google" → Google consent screen → redirect back with token → backend validates and maps email to user record
- **Authorization:** Email-based; only pre-registered emails (added via Org Structure admin screen) can log in
- **Session:** JWT tokens with refresh mechanism

---

## 5. Screens & Features

### 5.1 Login Screen

- ModuCraft Furniture CRM branding/logo
- Hero image of furniture workspace
- Single "Login with Google" button
- Redirects to appropriate dashboard based on role after authentication

### 5.2 Leads List Screen (Sales Executive View)

**Layout:** Tabular list view with the following default columns:
- Checkbox (bulk select)
- Lead Name
- Company
- Status (color-coded badge)
- Last Activity (date/time)
- Priority
- Assigned To
- Quick Actions menu (3-dot): Call, Email, Add Note

**Column Customization:**
- A "Columns" button (gear/settings icon) in the table toolbar opens a dropdown/modal listing all available columns
- Users can toggle visibility of individual columns via checkboxes
- Available columns include: Lead Name, Company, Status, Last Activity, Priority, Source, Assigned To, Budget, Location, Delivery Timeline, Property in Possession, Campaign Name, Created Date
- Column preferences are persisted per user across sessions (saved to database)
- **Filter preferences** (status, priority, source, budget range, location, campaign, etc.) are persisted across browser sessions via localStorage
- A "Clear All Filters" option resets filters and clears persisted state
- A "Reset to Default" option restores the original column set

**Search:**
- A global search bar at the top of the leads list
- Searches across lead name, company, and contact information
- Real-time filtering as the user types (debounced)

**Sorting:**
- New leads appear on top (sorted by creation date descending)
- Older leads sorted by status, then date

**Filtering:**
- Filter panel accessible via a "Filters" button in the toolbar
- Supported filters:
  - By status: New, Follow-up, MQL, MUQL, Junk
  - By priority: P1 (Very High), P2 (High), P3 (Normal)
  - By source
  - By assigned user
  - By last activity: "No activity in last N days" (user-configurable number of days)
  - By budget range (min / max)
  - By location
  - By property in possession (Yes / No)
  - By campaign name
  - By campaign status (Active / Not Active)
  - By created date range
- Multiple filters can be combined (AND logic)
- Active filters are shown as removable chips/tags above the table
- "Clear All Filters" option to reset

**View Toggle:**
- "Sales Exec View" (own leads only) — default for SE role
- Owner/SM sees additional toggle to view all/team leads

### 5.3 Lead Detail Screen

**Header Section:**
- Lead name and company name
- Current status badge
- Priority indicator
- Source attribution
- Assigned owner

**Lead Information:**
- Designation: Mr., Mrs., Dr., Ar.
- First Name
- Middle Name
- Last Name
- Company
- Lead Owner (assigned sales executive)
- Lead Origin / Source: Repeat, Instagram, FB Ads, Google Ads, Meta Ads, Walk-in, Referral
  - For Google Ads and Meta Ads sources: ability to enter a custom Campaign Name (free text)
  - Campaign Active Flag: Active / Not Active toggle; status can be changed at any time
- Lead Status: New → Follow-up → MQL → MUQL → Junk
- Priority: P1 (Very High), P2 (High), P3 (Normal)
- Budget
- Location
- Delivery Timeline

**Additional Contacts:**
- **Contact 2 (typically Spouse / Children):**
  - Name
  - Phone
  - Email
  - Relationship to Primary Contact (e.g., Spouse, Son, Daughter)
- **Contact 3 (typically Architect / Engineer):**
  - Name
  - Phone
  - Email
  - Relationship to Primary Contact (e.g., Architect, Engineer, Interior Designer)

**Property Information:**
- Property in Possession: Yes / No
- If No:
  - Expected Handover Month & Year (month-year picker)
- Current Living Area (free text, e.g., "Bay Area")
- Current Living City (e.g., "San Francisco")
- Current Living Country (e.g., "USA")
- Property Location (existing Location field — city where the property/project is, e.g., "Vizag")

**Lead Details Tab:**
- Budget: e.g., ₹15 Lakhs
- Location: e.g., Hyderabad
- Delivery: e.g., 60 Days

**Action Buttons:**
- **Log Call** — Record a call with notes
- **Schedule Meeting (Google Calendar)** — Opens Google Calendar to schedule a meeting:
  - Launches a scheduling modal/form pre-filled with the lead's name and email
  - On submission, creates the event directly in Google Calendar via the Calendar API
  - Optionally generates a Google Meet link (checkbox, default checked)
  - The scheduled meeting is logged as a MEETING activity on the lead's timeline
- **Add Task** — Create a follow-up task with details:
  - Task description / title (required)
  - Detailed notes (optional)
  - **Due Date** (required) — date picker for when the task must be completed
  - Assigned to (defaults to current user)
  - On save, the task is logged as a TASK activity on the lead's timeline
  - **Overdue Indication:** When a task's due date has passed and it is not marked as completed:
    - The task appears with a red "Overdue" badge in the Activity History
    - An overdue notification/alert is shown to the assigned user on their dashboard
    - Overdue tasks are highlighted in the activity feed with a distinct visual indicator (red border or background tint)
- **Upload File** — Attach documents to a specific sub-category

**Tabs:**
1. **Activity History** — Chronological feed of all interactions:
   - Notes (with date, author, content)
   - Calls (logged with outcome)
   - Status changes (with timestamp and note)
   - Meetings scheduled
   - Files uploaded
   - Quotations sent/revised

2. **Quotations** — List of quotations:
   - Initial quotation (v1)
   - Revised quotations (v2, v3, ...)
   - Each with date, amount, attachment, and version number
   - Status: Draft, Sent, Accepted, Rejected
   - **Add Quotation flow:**
     - Opens a modal/form with the following fields:
       - **Quotation Document** (required) — File upload picker to select and upload a quotation document (PDF, DOCX, etc.) from the user's desktop
       - **Amount** (required) — Numeric input for the quotation amount (₹)
       - **Version Number** — Auto-incremented (v1, v2, v3…) based on existing quotations for the lead; displayed as read-only
       - Status selector (Draft, Sent, Accepted, Rejected) — defaults to Draft
     - On save, the quotation is recorded with the uploaded document, amount, and version, and a QUOTATION activity is logged on the lead's timeline

3. **Lead Details** — Editable form with all lead fields (including additional contacts and property information)

4. **Files** — File attachment management organized by sub-categories:
   - **Floor Plans** — Upload and manage multiple floor plan files
   - **Detailing Files** — Upload and manage multiple detailing/specification files
   - **Reference Images** — Upload and manage multiple reference/inspiration images
   - Each sub-category displays a list of uploaded files with filename, upload date, uploaded by, and file size
   - **Upload flow:**
     - Click "Upload File" within a sub-category section
     - A **native file picker dialog** opens allowing the user to browse and select file(s) from their desktop/local file system
     - Selected files are uploaded and automatically placed under the chosen sub-category (Floor Plans, Detailing Files, or Reference Images)
     - Supports selecting multiple files at once for batch upload
     - Upload progress indicator shown during upload
     - Accepted file types: PDF, PNG, JPG, JPEG, DWG, DXF, DOCX (configurable)
   - Supports drag-and-drop as an alternative upload method
   - Actions per file: Download, Preview (for images/PDFs), Delete
   - Files uploaded here also appear in the Activity History timeline

### 5.4 Sales Qualification Screen

Same layout as Lead Detail screen with additional focus on:
- Quotation management (initial + revisions)
- Revised Quotation creation
- Qualification criteria matching (auto-check against MQL/SQL rules)
- History of all quotation-related activities
- Attachment additions

### 5.5 Management Dashboard

**Visible to:** Owner & Senior Sales Managers

**Layout:** Tabbed interface with three sections — Overview, Performance, Alerts

#### 5.5.1 Overview Tab

1. **KPI Cards** (6 cards across)
   - Total Leads, New Leads, MQL, SQL, Won, Conversion Rate %
   - **Clickable Tiles:** Each KPI card is clickable. Clicking a tile (e.g., Total Leads, New Leads, MQL, SQL, Won) navigates to a filtered leads list view showing only the leads belonging to that category
   - The filtered leads list view has **full feature parity** with the Leads List Screen (Section 5.2), including:
     - **Search bar** for free-text search across lead names, emails, and phone numbers
     - **Quick filter dropdowns** for Status, Priority, and Source (the Status dropdown is pre-set to the tile's category but can be changed by the user)
     - **Advanced Filters panel** (toggle) with: Budget Min/Max range, Location, Days with No Activity, Campaign, Possession (Yes/No), and Created After date
     - **Column Picker** allowing the user to show/hide any of the 12 available columns; selections are persisted to the user's saved column preferences (same as the Leads List)
     - **Dynamic column rendering** matching the user's column preferences with the same `ALL_COLUMNS` / `DEFAULT_COLUMNS` configuration
     - **Active filter count badge** displayed on the filter controls (excluding the pre-set tile status filter)
     - **Clear Filters** button that resets filters back to the tile's original category filter
   - A **Back button** is prominently displayed at the top of the filtered list to return the user to the Management Dashboard Overview tab
   - Conversion Rate % tile is informational only (not clickable)

2. **Booked Orders & Average Deal Size** — Two highlight cards

3. **Order Pipeline** — Horizontal bar funnel: New → MQL → SQL → Quoted → Won (color-coded)

4. **Team Performance (Last 30 Days)** — Stacked bar chart grouped by pipeline stage per team member

#### 5.5.2 Performance Tab

1. **Metrics Summary Cards** — Overall Conversion Rate %, Average Deal Size, Total Sources

2. **Trend Chart** — Line chart showing new leads vs. won leads
   - **Toggle control** (segmented button or dropdown) to switch between **Daily** and **Weekly** views
   - **Weekly view** (default): Shows trend over the last 8 weeks
   - **Daily view**: Shows trend over the last 30 days
   - The selected view preference persists during the session

3. **Lead Source Breakdown** — Donut/pie chart with legend (Repeat, Instagram, FB Ads, Google Ads, Walk-in, Referral, Website Enquiry)

4. **Team Leaderboard Table** — Ranked table with columns: Rank, Name, Total Leads, Won, Conversion %, Revenue. Color-coded conversion badges (green ≥20%, yellow ≥10%, red <10%)

#### 5.5.3 Alerts Tab

Alerts are categorized by severity level and sorted critical-first.

| Alert Type | Severity | Trigger |
|------------|----------|--------|
| Unattended Leads | 🔴 Critical | No activity for > N days (configurable, default 3) |
| Stuck P1 Leads | 🟠 High | P1-priority leads in New/Follow-up for > 2 days |
| SQL Leads Inactive | 🟡 Medium | SQL-qualified leads with no activity for > N days (configurable, default 5) |
| Excessive Quote Revisions | 🟡 Medium | Leads with > N quotation revisions (configurable, default 3) |
| Low Call Activity | 🔵 Low | Sales executives with < N calls in last 7 days (configurable, default 3) |

- Each alert shows severity badge, descriptive message, guidance text, and affected count
- Alerts are dismissible (client-side)
- Critical alerts appear as a banner on Overview/Performance tabs

### 5.6 Admin: MQL/SQL Criteria Settings

**Accessible to:** Owner only

**MQL Criteria — Rule Builder (default):**
| Field | Operator | Value |
|-------|----------|-------|
| budget | Greater than | 1500000 |
| property_in_possession | = | true |
| location | = | Hyderabad |

**SQL Criteria — Rule Builder (default):**
| Field | Operator | Value |
|-------|----------|-------|
| budget | Greater than | 2500000 |
| location | = | Hyderabad |

- Field names map to actual lead database columns (budget, location, source, priority, company, delivery_days, campaign_name, campaign_active, property_in_possession, current_living_city, current_living_country)
- Field selection uses a dropdown of valid fields (not free text)
- Add/remove rule rows dynamically
- **Save Criteria** button saves criteria and immediately re-evaluates all eligible leads
- When criteria are saved, **all eligible leads are immediately re-evaluated** against updated criteria
- Leads matching MQL criteria (but not SQL) → auto-set to MQL status
- Leads matching SQL criteria → auto-set to SQL status (SQL supersedes MQL)
- Leads previously at MQL/SQL that no longer match any criteria → auto-downgraded to FOLLOW_UP
- Leads previously at SQL that now only match MQL → auto-adjusted to MQL
- Re-evaluation handles both upgrades and downgrades in a single pass
- Terminal statuses (QUOTED, WON, JUNK, MUQL) are excluded from auto-qualification
- Saving with an empty criteria set for a type deactivates all criteria of that type
- Individual lead create/update also triggers qualification check (upgrade only, with downgrade if criteria no longer match)

### 5.7 Admin: Alerts Configuration

**Accessible to:** Owner only

- **Unattended Leads Alert (Days):** [input: 3] — Alert when a lead has no activity for N days
- **Leads with More Than [input: 3] Quote Revisions** — Flag leads with excessive revisions
- **No Activity on SQL Lead for (Days):** [input: 5] — Alert for SQL-qualified leads going cold
- **Save Alert Settings** button

### 5.8 Admin: Organization Structure & Roles

**Accessible to:** Owner only

**View Toggle:** Org Tree view ↔ Roles Table view

**Stats Row:** Total Users, Owners, Managers, Executives — four summary cards

#### Org Tree View

**Left Panel — Org Tree (3/4 width):**
- Visual hierarchy tree with drag-and-drop re-arrangement
- Roles: Owner/CEO → Senior Sales Manager (SM) → Sales Executive (SE)
- Each node shows role title, name, and active/inactive indicator
- **Hover actions** on each node:
  - ✏️ Edit — opens Edit User modal (change role, toggle active status)
  - ⏸/▶ Activate/Deactivate toggle (not available for Owner)

**Right Panel — Unassigned Users (1/4 width):**
- List of registered users not yet placed in org tree
- Drag from list to tree to assign role and reporting line

#### Roles Table View

- Full-width table with columns: User (avatar + name), Email, Role, Reports To, Status, Actions
- **Inline role editing:** Dropdown to change role (Senior Manager ↔ Sales Executive); Owner role is read-only
- **Active/Inactive toggle:** Switch control per user row (Owner always active)
- **Edit button:** Opens Edit User modal for combined role + status changes
- Inactive users rendered at 50% opacity

#### Edit User Modal

- Displays user name and email
- Role dropdown (Owner role locked)
- Active status toggle (Owner always active)
- Save Changes button

### 5.9 Calendar Screen

**Visible to:** All authenticated users

**Connect Flow:**
- If Google Calendar is not connected, show a connect prompt with "Connect Google Calendar" button
- OAuth 2.0 flow with offline access → stores refresh token
- Redirect back to Settings page after authorization

**Connected State:**

1. **Quick Stats** — Upcoming events count, events with Meet links, past events count

2. **Upcoming Events** — List of future events, each showing:
   - Date pill (month + day)
   - Title, date/time range, description preview
   - "Join Meet" button (if Meet link exists)
   - "Open in Google Calendar" link
   - Attendee count
   - Delete button

3. **Past Events** — Dimmed list of completed events (last 10)

4. **Create Event Modal** — Fields:
   - Title (required)
   - Description
   - Start Time / End Time (datetime pickers, required)
   - Link to Lead (dropdown of existing leads)
   - Attendees (comma-separated emails)
   - Add Google Meet Link checkbox (default: checked)

**Behavior:**
- Creating an event syncs to Google Calendar and optionally generates a Google Meet link
- If linked to a lead, a MEETING activity is logged on that lead's timeline
- Deleting an event removes it from both the CRM and Google Calendar

### 5.11 Admin: Data Management

**Accessible to:** Owner (full access) · Senior Sales Manager (export & import only)

Available under **Settings → Data Management** tab.

#### Full Database Backup *(Owner only)*

- A **Download Backup** button generates and downloads a timestamped `.json` file containing every record across:
  - All leads (all fields)
  - All lead contacts (secondary and tertiary contacts)
  - All activities (notes, calls, meetings, tasks, status changes, file uploads, quotations)
  - All quotations
- File is named `vmcrm-backup-YYYY-MM-DD.json`
- Metadata block at the top of the file includes `exportedAt`, `exportedBy` (email), schema `version`, and row counts
- Intended for periodic manual archiving; recommended before major data operations
- Backend rate-limited to prevent abuse

#### Export Leads

- **Export as Excel (.xlsx)** — downloads a multi-column spreadsheet with all lead fields including *Assigned To* name
- **Export as CSV** — same data as Excel, UTF-8 BOM-prefixed for correct Excel encoding
- File named `leads-export-YYYY-MM-DD.xlsx / .csv`
- Exported columns: ID, First Name, Middle Name, Last Name, Designation, Company, Email, Phone, Status, Priority, Source, Campaign Name, Campaign Active, Assigned To, Budget, Location, Delivery Days, Property In Possession, Expected Handover Month, Expected Handover Year, Current Living Area, Current Living City, Current Living Country, Notes, Created At
- Boolean fields (Campaign Active, Property In Possession) exported as human-readable *Yes* / *No*

#### Import Leads

- **Download import template** — link downloads a pre-formatted `.xlsx` template with:
  - Sheet 1 (*Leads Import Template*): Column headers + one sample row
  - Sheet 2 (*Field Notes*): Allowed values and format rules for each column
- **Choose File & Import** — opens a native file picker accepting `.csv` or `.xlsx` files
  - File size limit: **5 MB**
  - Row limit: **1 000 rows** per import
  - Required field: **First Name** (rows missing it are skipped with an error message)
  - Optional fields default: Status → NEW, Priority → P3; invalid enum values are silently defaulted
  - Boolean fields (Campaign Active, Property In Possession): accept `Yes/No`, `true/false`, `1/0`
  - Each imported lead is assigned to and created by the importing user
  - Import runs inside a single DB transaction; individual row failures do not abort the rest
- **Import result panel** (shown after each import):
  - Count of successfully imported leads
  - Count of skipped rows (with reason per row, e.g., "Missing First Name")
  - Colour-coded: green for clean import, yellow if any rows were skipped

---

### 5.10 Admin: Integrations Settings

**Accessible to:** Owner only (under Settings → Integrations tab)

- **Google Calendar & Meet** card:
  - Shows connection status (Connected / Not connected)
  - "Connect Google Calendar" button (triggers OAuth flow)
  - "Disconnect" button (clears stored tokens)
  - Description of capabilities
- **Email Integration** card — Placeholder (Coming Soon)

---

## 6. Data Model

### 6.1 Core Entities

**Users**
- id, email, name, avatar_url, role (OWNER, SENIOR_MANAGER, SALES_EXECUTIVE), reports_to (user_id), is_active, google_access_token, google_refresh_token, google_token_expiry, leads_column_preferences (JSON, nullable — stores visible column list per user), created_at, updated_at

**Leads**
- id, designation (MR, MRS, DR, AR), first_name, middle_name, last_name, company, status (NEW, FOLLOW_UP, MQL, SQL, MUQL, JUNK, QUOTED, WON), priority (P1, P2, P3), source (REPEAT, INSTAGRAM, FB_ADS, GOOGLE_ADS, META_ADS, WALK_IN, REFERRAL, WEBSITE_ENQUIRY), campaign_name (nullable, free text for Google Ads / Meta Ads), campaign_active (boolean, nullable), assigned_to (user_id), budget, location, delivery_days, property_in_possession (boolean), expected_handover_month (nullable, integer 1-12), expected_handover_year (nullable, integer), current_living_area (nullable), current_living_city (nullable), current_living_country (nullable), created_by (user_id), created_at, updated_at

**Lead Contacts** (additional contacts associated with a lead)
- id, lead_id (FK → Leads), contact_order (2 or 3), name, phone, email, relationship (e.g., Spouse, Son, Daughter, Architect, Engineer, Interior Designer), created_at, updated_at

**Activities**
- id, lead_id, user_id, type (NOTE, CALL, MEETING, STATUS_CHANGE, FILE_UPLOAD, QUOTATION, TASK), content, metadata (JSON), due_date (nullable, date — required for TASK type), is_completed (boolean, default false — used for TASK type), created_at

**Quotations**
- id, lead_id, version, amount, file_url, status (DRAFT, SENT, ACCEPTED, REJECTED), created_by, created_at, updated_at

**Files**
- id, lead_id, activity_id, filename, file_url, file_type, file_size, sub_category (FLOOR_PLANS, DETAILING_FILES, REFERENCE_IMAGES, GENERAL), uploaded_by, created_at

**Alert Settings**
- id, setting_key, setting_value, updated_by, updated_at

**MQL/SQL Criteria**
- id, type (MQL, SQL), field, operator, value, is_active, created_by, created_at, updated_at

**Calendar Events**
- id, lead_id (nullable FK → Leads), user_id (FK → Users), google_event_id, title, description, start_time, end_time, meet_link, html_link, attendees (JSON), created_at

---

## 7. Lead Status Flow

```
NEW → FOLLOW_UP → MQL → SQL → QUOTED → WON
         ↓          ↓      ↓
       JUNK       MUQL   JUNK
```

**Status Definitions:**
- **NEW:** Freshly captured lead, no contact yet
- **FOLLOW_UP:** Initial contact made, in active follow-up
- **MQL (Marketing Qualified Lead):** Meets configurable marketing criteria
- **SQL (Sales Qualified Lead):** Meets sales qualification (BANT, decision maker)
- **MUQL (Marketing Unqualified Lead):** Failed MQL criteria
- **QUOTED:** Quotation sent to lead
- **WON:** Order confirmed / booked
- **JUNK:** Disqualified or irrelevant lead

---

## 8. Alerts System

| Alert | Trigger | Default | Severity |
|-------|---------|---------|----------|
| Unattended leads | No activity for N days | 3 days | 🔴 Critical |
| Stuck P1 leads | P1-priority leads stuck in New/Follow-up for > 2 days | 2 days | 🟠 High |
| SQL leads going cold | No activity on SQL lead for N days | 5 days | 🟡 Medium |
| Excessive revisions | More than N quote revisions | 3 revisions | 🟡 Medium |
| Low call activity | SE with fewer than N calls in last 7 days | 3 calls | 🔵 Low |

Alerts appear on the Management Dashboard Alerts tab (sorted by severity, critical-first) and can be configured in Admin settings. Critical alerts also display as banners on the Overview and Performance tabs.

---

## 9. Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| Google OAuth 2.0 | Authentication (login) | ✅ Implemented |
| Google Calendar API | Schedule meetings, sync events, view upcoming/past events | ✅ Implemented |
| Google Meet | Auto-generate meeting links when creating calendar events | ✅ Implemented |
| Google OAuth 2.0 (Calendar scope) | Separate OAuth flow for Calendar API access with offline refresh tokens | ✅ Implemented |

---

## 10. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, React Router, Apollo Client |
| Backend | Node.js, Express.js, Apollo Server (GraphQL) |
| Database | SQLite (via better-sqlite3) |
| File Processing | SheetJS (xlsx) — Excel & CSV generation/parsing |
| File Upload | multer (memory storage, 5 MB limit) |
| Auth | Google OAuth 2.0, JWT |
| Charts | Recharts |
| Drag & Drop | @dnd-kit/core |
| Build Tool | Vite |

---

## 11. Design Specifications

- **Primary Color:** Indigo (#4F46E5 / Tailwind `indigo-600`)
- **Font Family:** Inter (Google Fonts)
- **Status Badge Colors:**
  - NEW: Blue (#3B82F6)
  - FOLLOW_UP: Yellow (#F59E0B)
  - MQL: Indigo (#4F46E5)
  - SQL: Purple (#7C3AED)
  - QUOTED: Cyan (#06B6D4)
  - WON: Green (#10B981)
  - MUQL: Orange (#F97316)
  - JUNK: Gray (#6B7280)
- **Priority Colors:**
  - P1: Red
  - P2: Orange
  - P3: Blue
- **Layout:** Sidebar navigation (Dashboard, Leads, Calendar, Settings)

---

## 12. Non-Functional Requirements

- **Performance:** Page load < 2 seconds, API response < 500ms
- **Security:** HTTPS, JWT with expiry, role-based access control on every API endpoint
- **Scalability:** Handles 10,000+ leads, 50+ concurrent users
- **Browser Support:** Chrome 90+, Edge 90+, Firefox 90+, Safari 14+
- **Mobile:** Responsive design (mobile-friendly, not a native app)

---

## 13. Future Considerations (Out of Scope for V2)

- Email integration (send/receive from CRM) — placeholder added in Integrations settings
- WhatsApp Business API integration
- Automated lead scoring
- Custom reports builder
- Mobile native app (React Native)
- Webhooks for external integrations

---

## 14. Changelog

### V2.7 (May 11, 2026)

| Area | Change |
|------|--------|
| Data Management — Backup | New **Full Database Backup** feature (Owner only): downloads a timestamped `.json` file containing all leads, contacts, activities, and quotations via `GET /api/leads/backup` |
| Data Management — Export | New **Export Leads** feature (Owner + Senior Manager): exports all leads to `.xlsx` or `.csv` via `GET /api/leads/export?format=xlsx\|csv` |
| Data Management — Import | New **Bulk Import Leads** feature (Owner + Senior Manager): upload `.csv` or `.xlsx` file to bulk-create up to 1 000 leads at a time via `POST /api/leads/import`; includes row-level validation, error reporting, and transactional insert |
| Data Management — Template | New **Import Template** download (Owner + Senior Manager): pre-formatted `.xlsx` file with headers, sample row, and a Field Notes sheet explaining allowed values |
| Settings UI | Added **Data Management** tab to the Settings page with Backup, Export, and Import cards |
| Permissions | Updated permission matrix: Backup = Owner only; Export & Import = Owner + Senior Manager |
| Tech Stack | Added `xlsx` (SheetJS) and `multer` dependencies to the backend |
| Proxy | Vite dev proxy and Nginx production config extended with `/api` → backend routing |

### V2.6 (April 9, 2026)

| Area | Change |
|------|--------|
| MQL/SQL Criteria Engine | Added `>=` (greater than or equal) and `<=` (less than or equal) comparison operators to the criteria evaluation engine, both in the backend (`evaluateCriterion`) and the Settings UI operator dropdown |
| Dashboard MQL/SQL Tiles | MQL and SQL KPI tile counts are now **criteria-based** rather than status-based. The MQL tile shows the count of all leads matching active MQL criteria (including SQL-status leads that also qualify), and likewise for SQL. This ensures the tile count matches what users see in the drilldown |
| Dashboard Drilldown | MQL/SQL tile drilldowns now use a new `matchesCriteria` GraphQL filter instead of filtering by status. This shows all leads that match the respective criteria regardless of their current status |
| GraphQL Schema | Added `matchesCriteria: CriteriaType` field to `LeadFilters` input, allowing queries to filter leads by criteria evaluation rather than just status |
| Seed Data | Updated MQL budget criterion from `greater_than` to `greater_than_or_equal` (≥ 15,00,000) and re-evaluated all leads. Arjun Mehta (budget exactly ₹15,00,000) now correctly classified as MQL |

### V2.5 (April 9, 2026)

| Area | Change |
|------|--------|
| Dashboard Drilldown | KPI tile drilldown views now have full feature parity with the Leads List page: search bar, status/priority/source filter dropdowns, advanced filters panel (budget range, location, no activity days, campaign, possession, created after), column picker with persistence, and dynamic column rendering |
| Dashboard Drilldown | Tile's category filter (e.g., MQL, SQL) is pre-applied as the default status filter; users can modify or clear it. Active filter count badge excludes the pre-set tile status |
| Dashboard Drilldown | Column visibility syncs from the user's saved column preferences (same as Leads List) and changes are persisted via the `SAVE_COLUMN_PREFERENCES` mutation |

### V2.4 (April 9, 2026)

| Area | Change |
|------|--------|
| MQL/SQL Criteria | Fixed `reEvaluateAllLeads` to handle SQL→MQL downgrades: previously, leads at SQL status that only matched MQL criteria after a criteria change were stuck at SQL (rank comparison only allowed upgrades). Now correctly re-classifies in both directions |
| MQL/SQL Criteria | Fixed `applyQualification` (individual lead create/update) to also downgrade leads that no longer match any criteria back to FOLLOW_UP |
| Seed Data | Added 7 guaranteed leads (4 MQL-only + 3 SQL) to ensure MQL/SQL criteria always produce visible results. Also fixed post-seed evaluation to downgrade randomly-assigned MQL/SQL leads that don't actually match criteria |
| Seed Data | Default MQL criteria now include location=Hyderabad alongside budget>15L and possession=true, matching the SQL criteria pattern |

### V2.3 (April 9, 2026)

| Area | Change |
|------|--------|
| MQL/SQL Criteria | Fixed criteria not being applied to leads when saved; mutations are now always sent for both MQL and SQL types (even if empty) to properly deactivate old criteria |
| MQL/SQL Criteria | Criteria field names are now lowercase and match actual database columns (budget, location, etc.); field selection uses a dropdown of valid fields |
| MQL/SQL Criteria | Re-evaluation engine now both upgrades and downgrades leads: leads that no longer match criteria are reverted from MQL/SQL to FOLLOW_UP with activity logging |
| Leads List — Persistence | Column preferences now properly sync from database on page load (via useEffect) |
| Leads List — Persistence | Filter and search state is now persisted across browser sessions via localStorage for all users |
| Leads List — Persistence | Clear All Filters also clears persisted localStorage state |
| UI — Alternating Rows | Added subtle alternating row coloring (bg-gray-50/60 on odd rows) to all table views: Leads List, Dashboard Team Leaderboard, Dashboard Leads Table, Org Structure, and Settings Criteria |
| Seed Data | Expanded sample data from 11 to 100 leads with diverse budgets (₹2L–50L), 20 locations, varied statuses/priorities/sources, campaign data, property info, and NRI contacts for thorough testing |
| Seed Data — Criteria | Default MQL/SQL criteria now use correct lowercase field names matching the evaluation engine (budget, property_in_possession, location) |
| Default Query Limit | Leads query default limit increased from 50 to 200 to show all leads without pagination |
| Notifications | Global Snackbar-based notification system (notistack) for all success/error feedback across pages |

### V2.2 (April 5, 2026)

| Area | Change |
|------|--------|
| Dashboard — Overview | KPI tiles (Total Leads, New Leads, MQL, SQL, Won) are now clickable; clicking navigates to a filtered leads list showing only leads of that category, with a Back button to return to the dashboard |
| Dashboard — Performance | Trend chart now supports both Daily and Weekly views via a toggle control; daily shows last 30 days, weekly shows last 8 weeks |
| Lead Detail — Schedule Meeting | Schedule Meeting now opens Google Calendar integration to create an event pre-filled with lead details, with optional Google Meet link generation |
| Lead Detail — Add Task | Add Task now collects task description, optional notes, and a required Due Date; overdue tasks are indicated with a red badge in Activity History and trigger user notifications |
| Lead Detail — Quotations | Add Quotation now provides a document file upload picker, amount field, and auto-incremented version number; quotation document is uploaded from desktop |
| Lead Detail — Files | Upload File now opens a native file picker dialog to select files from desktop; supports batch upload, progress indicator, and configurable accepted file types (PDF, PNG, JPG, DWG, DXF, DOCX) |
| Data Model | Added `due_date` and `is_completed` fields to Activities table for task tracking and overdue detection |

### V2.1 (March 29, 2026)

| Area | Change |
|------|--------|
| Leads List | Added column customization — users can toggle visible columns via a Columns button; preferences persist per user |
| Leads List | Added global search bar with real-time filtering across lead name, company, and contacts |
| Leads List | Expanded filter panel with activity-based filters (no activity in last N days), budget range, location, property in possession, campaign name/status, and created date range; active filters shown as removable chips |
| Lead Detail | Replaced single Lead Name with Designation (Mr./Mrs./Dr./Ar.), First Name, Middle Name, Last Name |
| Lead Detail | Added two additional contacts: Contact 2 (Spouse/Children) and Contact 3 (Architect/Engineer) with name, phone, email, and relationship fields |
| Lead Detail | Added Property Information section: Property in Possession (Yes/No), conditional Expected Handover Month & Year, Current Living Area/City/Country |
| Lead Source | Added Meta Ads as a new source option |
| Lead Source | For Google Ads and Meta Ads sources: ability to enter custom Campaign Name and toggle campaign Active/Not Active status |
| Priority | Removed P4 (Least) — priority levels are now P1 (Very High), P2 (High), P3 (Normal) |
| Files | Added file attachment sub-categories: Floor Plans, Detailing Files, Reference Images; supports multiple file uploads per sub-category with preview, download, and delete actions |
| Data Model | Added `lead_contacts` table for additional contacts; added designation, name split, property, campaign, and living location columns to `leads`; added `sub_category` to `files`; added `leads_column_preferences` to `users` |

### V2.0 (March 1, 2026)

| Area | Change |
|------|--------|
| Dashboard | Added tabbed interface (Overview / Performance / Alerts) |
| Dashboard — Alerts | 5 alert types with severity levels (critical, high, medium, low); dismissible; critical banners |
| Dashboard — Performance | Conversion rate, avg deal size, weekly trend chart, source breakdown pie chart, team leaderboard table |
| Dashboard — KPIs | Expanded from 4 to 6 cards (added SQL count, conversion rate) |
| Org Structure | Added Roles Table view with inline role editing and active/inactive toggle |
| Org Structure | Added Edit User modal, hover action buttons on tree nodes, stats row |
| Calendar | New Calendar page with event list, create/delete events, Google Meet link generation |
| Settings | Added Integrations tab with Google Calendar connect/disconnect |
| Google Calendar | Full OAuth 2.0 integration with offline access, token refresh, event CRUD |
| Google Meet | Auto-generate Meet links when creating calendar events |
| Database | Migrated from PostgreSQL to SQLite (better-sqlite3) |
| Data Model | Added `calendar_events` table; added google token columns to `users` |
