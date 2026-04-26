require('dotenv').config();
const db = require('./pool');
const { v4: uuidv4 } = require('uuid');

const migrations = [
  // ── Users table ──
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'SALES_EXECUTIVE' 
      CHECK (role IN ('OWNER', 'SENIOR_MANAGER', 'SALES_EXECUTIVE')),
    reports_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    leads_column_preferences TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── Leads table (v2.1) ──
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    designation TEXT DEFAULT 'MR' CHECK (designation IN ('MR', 'MRS', 'DR', 'AR')),
    first_name TEXT NOT NULL DEFAULT '',
    middle_name TEXT,
    last_name TEXT,
    company TEXT,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'NEW'
      CHECK (status IN ('NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK')),
    priority TEXT NOT NULL DEFAULT 'P3'
      CHECK (priority IN ('P1', 'P2', 'P3')),
    source TEXT
      CHECK (source IN ('REPEAT', 'INSTAGRAM', 'FB_ADS', 'GOOGLE_ADS', 'META_ADS', 'WALK_IN', 'REFERRAL', 'WEBSITE_ENQUIRY')),
    campaign_name TEXT,
    campaign_active INTEGER,
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    budget REAL,
    location TEXT,
    delivery_days INTEGER,
    property_in_possession INTEGER DEFAULT 0,
    expected_handover_month INTEGER,
    expected_handover_year INTEGER,
    current_living_area TEXT,
    current_living_city TEXT,
    current_living_country TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── Lead Contacts table (v2.1) ──
  `CREATE TABLE IF NOT EXISTS lead_contacts (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    contact_order INTEGER NOT NULL CHECK (contact_order IN (2, 3)),
    name TEXT,
    phone TEXT,
    email TEXT,
    relationship TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(lead_id, contact_order)
  );`,

  // ── Activities table (v2.2 — due_date, is_completed for TASK) ──
  `CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL
      CHECK (type IN ('NOTE', 'CALL', 'MEETING', 'STATUS_CHANGE', 'FILE_UPLOAD', 'QUOTATION', 'TASK')),
    content TEXT,
    metadata TEXT DEFAULT '{}',
    due_date TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── Quotations table ──
  `CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    amount REAL,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
      CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(lead_id, version)
  );`,

  // ── Files table (v2.1 — sub_category) ──
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    sub_category TEXT DEFAULT 'GENERAL'
      CHECK (sub_category IN ('FLOOR_PLANS', 'DETAILING_FILES', 'REFERENCE_IMAGES', 'GENERAL')),
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── Alert Settings table ──
  `CREATE TABLE IF NOT EXISTS alert_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── MQL/SQL Criteria table ──
  `CREATE TABLE IF NOT EXISTS qualification_criteria (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('MQL', 'SQL')),
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );`,

  // ── Indexes ──
  `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`,
  `CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);`,
  `CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);`,
  `CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);`,
  `CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_name);`,
  `CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_files_lead_id ON files(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_files_sub_category ON files(sub_category);`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
  `CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to);`,
  `CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON lead_contacts(lead_id);`,

  // ── Google Calendar token columns (v2) ──
  `ALTER TABLE users ADD COLUMN google_access_token TEXT;`,
  `ALTER TABLE users ADD COLUMN google_refresh_token TEXT;`,
  `ALTER TABLE users ADD COLUMN google_token_expiry TEXT;`,

  // ── v2.1 migration columns for existing DBs ──
  `ALTER TABLE users ADD COLUMN leads_column_preferences TEXT;`,
  `ALTER TABLE leads ADD COLUMN designation TEXT DEFAULT 'MR';`,
  `ALTER TABLE leads ADD COLUMN first_name TEXT DEFAULT '';`,
  `ALTER TABLE leads ADD COLUMN middle_name TEXT;`,
  `ALTER TABLE leads ADD COLUMN last_name TEXT;`,
  `ALTER TABLE leads ADD COLUMN campaign_name TEXT;`,
  `ALTER TABLE leads ADD COLUMN campaign_active INTEGER;`,
  `ALTER TABLE leads ADD COLUMN property_in_possession INTEGER DEFAULT 0;`,
  `ALTER TABLE leads ADD COLUMN expected_handover_month INTEGER;`,
  `ALTER TABLE leads ADD COLUMN expected_handover_year INTEGER;`,
  `ALTER TABLE leads ADD COLUMN current_living_area TEXT;`,
  `ALTER TABLE leads ADD COLUMN current_living_city TEXT;`,
  `ALTER TABLE leads ADD COLUMN current_living_country TEXT;`,
  `ALTER TABLE files ADD COLUMN sub_category TEXT DEFAULT 'GENERAL';`,

  // ── v2.2 migration columns for existing DBs ──
  `ALTER TABLE activities ADD COLUMN due_date TEXT;`,
  `ALTER TABLE activities ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);`,

  // ── Calendar Events table (v2) ──
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    meet_link TEXT,
    html_link TEXT,
    attendees TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON calendar_events(lead_id);`,

  // ── Backfill: copy old name → first_name for existing rows ──
  `UPDATE leads SET first_name = name WHERE first_name IS NULL OR first_name = '';`,
];

function migrate() {
  try {
    console.log('Running migrations...');

    const transaction = db.transaction(() => {
      for (const sql of migrations) {
        try {
          db.exec(sql);
          console.log('  OK:', sql.substring(0, 60) + '...');
        } catch (err) {
          if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
            console.log('  SKIP (already exists):', sql.substring(0, 60) + '...');
          } else {
            throw err;
          }
        }
      }

      // Default alert settings
      const insertSetting = db.prepare(
        `INSERT OR IGNORE INTO alert_settings (id, setting_key, setting_value) VALUES (?, ?, ?)`
      );
      insertSetting.run(uuidv4(), 'unattended_leads_days', '3');
      insertSetting.run(uuidv4(), 'max_quote_revisions', '3');
      insertSetting.run(uuidv4(), 'sql_lead_inactive_days', '5');
      insertSetting.run(uuidv4(), 'min_calls_threshold', '3');
    });

    transaction();
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

migrate();
