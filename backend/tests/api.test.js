/**
 * Backend API Integration Tests
 * Tests GraphQL resolvers directly against a test database.
 * Run: node tests/api.test.js
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ── Setup: Create a separate test DB ──
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'vmcrm_test.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

// Override pool.js to use test DB BEFORE any imports
const testDb = new Database(TEST_DB_PATH);
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');
require.cache[require.resolve('../src/db/pool')] = { id: 'pool', exports: testDb, loaded: true };

const { v4: uuidv4 } = require('uuid');

// ── Run migrations on test DB ──
const migrateFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'migrate.js'), 'utf-8');
// Extract migration SQL statements manually
const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'SENIOR_MANAGER', 'SALES_EXECUTIVE')),
    avatar_url TEXT, reports_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_active INTEGER DEFAULT 1, leads_column_preferences TEXT,
    google_access_token TEXT, google_refresh_token TEXT, google_token_expiry TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY, name TEXT, designation TEXT DEFAULT 'MR',
    first_name TEXT DEFAULT '', middle_name TEXT, last_name TEXT,
    company TEXT, email TEXT, phone TEXT,
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW','FOLLOW_UP','MQL','SQL','MUQL','QUOTED','WON','JUNK')),
    priority TEXT DEFAULT 'P3' CHECK (priority IN ('P1','P2','P3')),
    source TEXT CHECK (source IN ('REPEAT','INSTAGRAM','FB_ADS','GOOGLE_ADS','WALK_IN','REFERRAL','WEBSITE_ENQUIRY','META_ADS')),
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    budget REAL, location TEXT, delivery_days INTEGER, notes TEXT,
    campaign_name TEXT, campaign_active INTEGER,
    property_in_possession INTEGER DEFAULT 0,
    expected_handover_month TEXT, expected_handover_year INTEGER,
    current_living_area TEXT, current_living_city TEXT, current_living_country TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS lead_contacts (
    id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    contact_order INTEGER NOT NULL, name TEXT, phone TEXT, email TEXT, relationship TEXT,
    UNIQUE(lead_id, contact_order)
  )`,
  `CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, content TEXT, metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1, amount REAL, file_url TEXT,
    status TEXT DEFAULT 'DRAFT', created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    filename TEXT NOT NULL, file_url TEXT NOT NULL, file_type TEXT, file_size INTEGER,
    sub_category TEXT DEFAULT 'GENERAL' CHECK (sub_category IN ('FLOOR_PLANS','DETAILING_FILES','REFERENCE_IMAGES','GENERAL')),
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS alert_settings (
    id TEXT PRIMARY KEY, setting_key TEXT UNIQUE NOT NULL, setting_value TEXT NOT NULL,
    updated_by TEXT, updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS qualification_criteria (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, field TEXT NOT NULL,
    operator TEXT NOT NULL, value TEXT NOT NULL, is_active INTEGER DEFAULT 1,
    created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_event_id TEXT, title TEXT NOT NULL, description TEXT,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    meet_link TEXT, html_link TEXT, attendees TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

for (const sql of migrations) {
  testDb.prepare(sql).run();
}

// ── Import resolvers (they now use our test DB) ──
const { generateToken, requireAuth, requireRole } = require('../src/auth/auth');

// Create resolvers manually (since the module imports pool which is now our test DB)
const resolvers = require('../src/graphql/resolvers');

// ── Test infrastructure ──
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passCount++;
    process.stdout.write('.');
  } else {
    failCount++;
    failures.push(message);
    process.stdout.write('F');
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected;
  if (!pass) {
    message = `${message} — expected "${expected}", got "${actual}"`;
  }
  assert(pass, message);
}

function assertIncludes(arr, item, message) {
  assert(Array.isArray(arr) && arr.includes(item), message);
}

function assertThrows(fn, message) {
  try {
    fn();
    assert(false, `${message} — expected to throw but did not`);
  } catch {
    passCount++;
    process.stdout.write('.');
  }
}

async function assertThrowsAsync(fn, message) {
  try {
    await fn();
    assert(false, `${message} — expected to throw but did not`);
  } catch {
    passCount++;
    process.stdout.write('.');
  }
}

// ── Seed test data ──
const ownerId = uuidv4();
const smId = uuidv4();
const seId = uuidv4();
const se2Id = uuidv4();

testDb.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(ownerId, 'owner@test.com', 'Test Owner', 'OWNER');
testDb.prepare('INSERT INTO users (id, email, name, role, reports_to) VALUES (?, ?, ?, ?, ?)').run(smId, 'sm@test.com', 'Test SM', 'SENIOR_MANAGER', ownerId);
testDb.prepare('INSERT INTO users (id, email, name, role, reports_to) VALUES (?, ?, ?, ?, ?)').run(seId, 'se@test.com', 'Test SE', 'SALES_EXECUTIVE', smId);
testDb.prepare('INSERT INTO users (id, email, name, role, reports_to) VALUES (?, ?, ?, ?, ?)').run(se2Id, 'se2@test.com', 'Test SE2', 'SALES_EXECUTIVE', smId);

// Create owner user object (simulating the context)
const ownerUser = { id: ownerId, email: 'owner@test.com', role: 'OWNER', name: 'Test Owner', is_active: 1 };
const smUser = { id: smId, email: 'sm@test.com', role: 'SENIOR_MANAGER', name: 'Test SM', is_active: 1 };
const seUser = { id: seId, email: 'se@test.com', role: 'SALES_EXECUTIVE', name: 'Test SE', is_active: 1 };

// ── Run Tests ──
async function runTests() {
  console.log('\n🧪 Running Backend API Tests...\n');

  // ════════════════════════════════
  // AUTH TESTS
  // ════════════════════════════════
  console.log('\n── Auth Tests ──');

  // Test: generateToken returns a string
  const token = generateToken(ownerUser);
  assert(typeof token === 'string' && token.length > 0, 'generateToken returns a JWT string');

  // Test: requireAuth throws when no user
  assertThrows(() => requireAuth(null), 'requireAuth throws for null user');
  assertThrows(() => requireAuth(undefined), 'requireAuth throws for undefined user');

  // Test: requireAuth passes with valid user
  assert(requireAuth(ownerUser) === ownerUser, 'requireAuth passes with valid user');

  // Test: requireRole throws for wrong role
  assertThrows(() => requireRole(seUser, ['OWNER']), 'requireRole throws for SE accessing OWNER');
  assertThrows(() => requireRole(smUser, ['OWNER']), 'requireRole throws for SM accessing OWNER-only');

  // Test: requireRole passes for correct role
  assert(requireRole(ownerUser, ['OWNER']) === ownerUser, 'requireRole passes for OWNER role');
  assert(requireRole(smUser, ['OWNER', 'SENIOR_MANAGER']) === smUser, 'requireRole passes for SM in allowed list');

  // Test: devLogin mutation
  const devLoginResult = resolvers.Mutation.devLogin(null, { email: 'owner@test.com' });
  assert(devLoginResult.token && devLoginResult.user, 'devLogin returns token and user');
  assertEqual(devLoginResult.user.email, 'owner@test.com', 'devLogin returns correct user');

  // Test: devLogin fails for non-existent user
  assertThrows(() => resolvers.Mutation.devLogin(null, { email: 'nobody@test.com' }), 'devLogin throws for non-existent user');

  // ════════════════════════════════
  // USER QUERY TESTS
  // ════════════════════════════════
  console.log('\n── User Query Tests ──');

  // Test: me query
  const meResult = resolvers.Query.me(null, null, { user: ownerUser });
  assert(meResult !== null, 'me returns user when authenticated');
  assertEqual(meResult.email, 'owner@test.com', 'me returns correct email');

  // Test: me returns null when not authenticated
  const meNull = resolvers.Query.me(null, null, { user: null });
  assert(meNull === null, 'me returns null when not authenticated');

  // Test: users query
  const usersResult = resolvers.Query.users(null, null, { user: ownerUser });
  assert(Array.isArray(usersResult) && usersResult.length >= 4, 'users query returns array of users');

  // Test: users throws for unauthenticated
  assertThrows(() => resolvers.Query.users(null, null, { user: null }), 'users query throws when not authenticated');

  // Test: orgStructure query
  const orgResult = resolvers.Query.orgStructure(null, null, { user: ownerUser });
  assert(Array.isArray(orgResult) && orgResult.length >= 4, 'orgStructure returns users');

  // ════════════════════════════════
  // LEAD CRUD TESTS - CREATE
  // ════════════════════════════════
  console.log('\n── Lead CRUD Tests ──');

  // Test: createLead with v2.1 fields
  const createResult = resolvers.Mutation.createLead(null, {
    input: {
      designation: 'MR',
      firstName: 'John',
      middleName: 'M',
      lastName: 'Doe',
      company: 'TestCorp',
      email: 'john@test.com',
      phone: '+911234567890',
      status: 'NEW',
      priority: 'P1',
      source: 'WEBSITE_ENQUIRY',
      budget: 1500000,
      location: 'Hyderabad',
      deliveryDays: 60,
      campaignName: 'Test Campaign',
      campaignActive: true,
      propertyInPossession: true,
      expectedHandoverMonth: 'March',
      expectedHandoverYear: 2026,
      currentLivingArea: 'Banjara Hills',
      currentLivingCity: 'Hyderabad',
      currentLivingCountry: 'India',
      contacts: [
        { contactOrder: 2, name: 'Jane Doe', phone: '+919876543210', email: 'jane@test.com', relationship: 'Spouse' },
      ],
    },
  }, { user: ownerUser });

  assert(createResult.id, 'createLead returns an ID');
  assertEqual(createResult.firstName, 'John', 'createLead stores firstName');
  assertEqual(createResult.middleName, 'M', 'createLead stores middleName');
  assertEqual(createResult.lastName, 'Doe', 'createLead stores lastName');
  assertEqual(createResult.designation, 'MR', 'createLead stores designation');
  assertEqual(createResult.company, 'TestCorp', 'createLead stores company');
  assertEqual(createResult.status, 'NEW', 'createLead stores status');
  assertEqual(createResult.priority, 'P1', 'createLead stores priority');
  assertEqual(createResult.source, 'WEBSITE_ENQUIRY', 'createLead stores source');
  assertEqual(createResult.location, 'Hyderabad', 'createLead stores location');
  assertEqual(createResult.campaignName, 'Test Campaign', 'createLead stores campaignName');
  assertEqual(createResult.currentLivingCity, 'Hyderabad', 'createLead stores currentLivingCity');

  const leadId = createResult.id;

  // Verify contacts were created
  const contacts = testDb.prepare('SELECT * FROM lead_contacts WHERE lead_id = ?').all(leadId);
  assert(contacts.length === 1, 'createLead creates 1 contact');
  assertEqual(contacts[0].name, 'Jane Doe', 'contact has correct name');
  assertEqual(contacts[0].relationship, 'Spouse', 'contact has correct relationship');

  // Verify activity log
  const activities = testDb.prepare('SELECT * FROM activities WHERE lead_id = ?').all(leadId);
  assert(activities.length >= 1, 'createLead logs an activity');

  // Test: createLead throws when not authenticated
  assertThrows(() => resolvers.Mutation.createLead(null, {
    input: { firstName: 'Fail', source: 'WALK_IN' },
  }, { user: null }), 'createLead throws for unauthenticated user');

  // Test: createLead with META_ADS source
  const metaLead = resolvers.Mutation.createLead(null, {
    input: {
      firstName: 'Meta',
      lastName: 'Lead',
      source: 'META_ADS',
      campaignName: 'FB Campaign Q1',
      campaignActive: true,
    },
  }, { user: ownerUser });
  assertEqual(metaLead.source, 'META_ADS', 'createLead supports META_ADS source');
  assertEqual(metaLead.campaignName, 'FB Campaign Q1', 'META_ADS lead stores campaign');

  // Test: createLead with P3 default priority
  const defaultPriorityLead = resolvers.Mutation.createLead(null, {
    input: { firstName: 'DefaultP' },
  }, { user: ownerUser });
  assertEqual(defaultPriorityLead.priority, 'P3', 'createLead defaults to P3 priority');

  // ════════════════════════════════
  // LEAD CRUD TESTS - READ
  // ════════════════════════════════
  console.log('\n── Lead Read Tests ──');

  // Test: lead query
  const leadResult = resolvers.Query.lead(null, { id: leadId }, { user: ownerUser });
  assert(leadResult !== null, 'lead query returns the lead');
  assertEqual(leadResult.id, leadId, 'lead query returns correct lead by ID');

  // Test: Lead type resolvers
  const leadContacts = resolvers.Lead.contacts(leadResult);
  assert(Array.isArray(leadContacts) && leadContacts.length === 1, 'Lead.contacts resolver returns contacts');
  assertEqual(leadContacts[0].name, 'Jane Doe', 'Lead.contacts returns correct contact name');

  const propertyVal = resolvers.Lead.propertyInPossession(leadResult);
  assertEqual(propertyVal, true, 'Lead.propertyInPossession converts 1 to true');

  const campaignActiveVal = resolvers.Lead.campaignActive(leadResult);
  assertEqual(campaignActiveVal, true, 'Lead.campaignActive converts 1 to true');

  // Test: leads query (list)
  const leadsResult = resolvers.Query.leads(null, { filters: {}, limit: 50, offset: 0 }, { user: ownerUser });
  assert(leadsResult.totalCount >= 3, 'leads query returns totalCount');
  assert(Array.isArray(leadsResult.leads) && leadsResult.leads.length >= 3, 'leads query returns leads array');

  // Test: leads with search filter
  const searchResult = resolvers.Query.leads(null, {
    filters: { search: 'John' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(searchResult.totalCount >= 1, 'leads search finds John');

  // Test: leads with status filter
  const statusFilter = resolvers.Query.leads(null, {
    filters: { status: 'NEW' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(statusFilter.leads.every(l => l.status === 'NEW'), 'leads status filter returns only NEW leads');

  // Test: leads with priority filter
  const priorityFilter = resolvers.Query.leads(null, {
    filters: { priority: 'P1' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(priorityFilter.leads.every(l => l.priority === 'P1'), 'leads priority filter returns only P1 leads');

  // Test: leads with budgetMin/budgetMax filter
  const budgetFilter = resolvers.Query.leads(null, {
    filters: { budgetMin: 1000000, budgetMax: 2000000 }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(budgetFilter.leads.every(l => l.budget >= 1000000 && l.budget <= 2000000), 'leads budget filter works');

  // Test: leads with location filter
  const locationFilter = resolvers.Query.leads(null, {
    filters: { location: 'Hyderabad' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(locationFilter.leads.every(l => l.location && l.location.includes('Hyderabad')), 'leads location filter works');

  // Test: leads with campaignName filter
  const campaignFilter = resolvers.Query.leads(null, {
    filters: { campaignName: 'Test Campaign' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(campaignFilter.totalCount >= 1, 'leads campaignName filter finds leads');

  // Test: leads with propertyInPossession filter
  const propertyFilter = resolvers.Query.leads(null, {
    filters: { propertyInPossession: true }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(propertyFilter.totalCount >= 1, 'leads propertyInPossession filter finds leads');

  // Test: leads with source filter
  const sourceFilter = resolvers.Query.leads(null, {
    filters: { source: 'META_ADS' }, limit: 50, offset: 0,
  }, { user: ownerUser });
  assert(sourceFilter.totalCount >= 1, 'leads META_ADS source filter works');

  // Test: SE can only see their own leads
  // Assign a lead to seId
  const seLead = resolvers.Mutation.createLead(null, {
    input: { firstName: 'SELead', assignedTo: seId },
  }, { user: ownerUser });
  const seLeadsResult = resolvers.Query.leads(null, { filters: {}, limit: 50, offset: 0 }, { user: seUser });
  assert(seLeadsResult.leads.every(l => l.assignedTo === seId), 'SE only sees their own leads');

  // ════════════════════════════════
  // LEAD CRUD TESTS - UPDATE
  // ════════════════════════════════
  console.log('\n── Lead Update Tests ──');

  // Test: updateLead basic fields
  const updateResult = resolvers.Mutation.updateLead(null, {
    id: leadId,
    input: {
      firstName: 'Johnny',
      lastName: 'Updated',
      company: 'UpdatedCorp',
      budget: 2000000,
    },
  }, { user: ownerUser });
  assertEqual(updateResult.firstName, 'Johnny', 'updateLead updates firstName');
  assertEqual(updateResult.lastName, 'Updated', 'updateLead updates lastName');
  assertEqual(updateResult.company, 'UpdatedCorp', 'updateLead updates company');
  // Check that name was auto-updated
  assert(updateResult.name.includes('Johnny'), 'updateLead auto-updates display name');

  // Test: updateLead with contacts upsert
  resolvers.Mutation.updateLead(null, {
    id: leadId,
    input: {
      contacts: [
        { contactOrder: 2, name: 'Updated Contact', phone: '+910000000000', email: 'updated@test.com', relationship: 'Friend' },
        { contactOrder: 3, name: 'New Contact', phone: '+911111111111', email: 'new@test.com', relationship: 'Parent' },
      ],
    },
  }, { user: ownerUser });
  const updatedContacts = testDb.prepare('SELECT * FROM lead_contacts WHERE lead_id = ? ORDER BY contact_order').all(leadId);
  assert(updatedContacts.length === 2, 'updateLead upserts contacts (old deleted, new inserted)');
  assertEqual(updatedContacts[0].name, 'Updated Contact', 'first contact updated correctly');
  assertEqual(updatedContacts[1].name, 'New Contact', 'second contact added correctly');

  // Test: updateLead with campaign/property fields
  resolvers.Mutation.updateLead(null, {
    id: leadId,
    input: {
      campaignName: 'Updated Campaign',
      campaignActive: false,
      propertyInPossession: false,
      expectedHandoverMonth: 'June',
      expectedHandoverYear: 2027,
      currentLivingArea: 'Jubilee Hills',
      currentLivingCity: 'Hyderabad',
      currentLivingCountry: 'India',
    },
  }, { user: ownerUser });
  const updatedLead = resolvers.Query.lead(null, { id: leadId }, { user: ownerUser });
  assertEqual(updatedLead.campaignName, 'Updated Campaign', 'updateLead updates campaignName');
  assertEqual(updatedLead.currentLivingArea, 'Jubilee Hills', 'updateLead updates livingArea');

  // Test: updateLead status change logs activity
  const beforeActivities = testDb.prepare("SELECT COUNT(*) as cnt FROM activities WHERE lead_id = ? AND type = 'STATUS_CHANGE'").get(leadId).cnt;
  resolvers.Mutation.updateLead(null, {
    id: leadId,
    input: { status: 'FOLLOW_UP' },
  }, { user: ownerUser });
  const afterActivities = testDb.prepare("SELECT COUNT(*) as cnt FROM activities WHERE lead_id = ? AND type = 'STATUS_CHANGE'").get(leadId).cnt;
  assert(afterActivities === beforeActivities + 1, 'updateLead logs status change activity');

  // Test: updateLead throws for non-existent lead
  assertThrows(() => resolvers.Mutation.updateLead(null, {
    id: 'non-existent-id',
    input: { firstName: 'X' },
  }, { user: ownerUser }), 'updateLead throws for non-existent lead');

  // Test: SE cannot update others' leads
  const otherLead = resolvers.Mutation.createLead(null, {
    input: { firstName: 'OtherLead', assignedTo: se2Id },
  }, { user: ownerUser });
  assertThrows(() => resolvers.Mutation.updateLead(null, {
    id: otherLead.id,
    input: { firstName: 'Hacked' },
  }, { user: seUser }), 'SE cannot update leads assigned to others');

  // ════════════════════════════════
  // LEAD CRUD TESTS - DELETE
  // ════════════════════════════════
  console.log('\n── Lead Delete Tests ──');

  const deleteLead = resolvers.Mutation.createLead(null, {
    input: { firstName: 'ToDelete' },
  }, { user: ownerUser });
  const deleteResult = resolvers.Mutation.deleteLead(null, { id: deleteLead.id }, { user: ownerUser });
  assertEqual(deleteResult, true, 'deleteLead returns true');
  const afterDelete = testDb.prepare('SELECT * FROM leads WHERE id = ?').get(deleteLead.id);
  assert(!afterDelete, 'deleteLead removes lead from DB');

  // Test: SE cannot delete leads
  assertThrows(() => resolvers.Mutation.deleteLead(null, { id: leadId }, { user: seUser }), 'SE cannot delete leads');

  // ════════════════════════════════
  // ACTIVITY TESTS
  // ════════════════════════════════
  console.log('\n── Activity Tests ──');

  // Test: createActivity
  const activityResult = resolvers.Mutation.createActivity(null, {
    input: { leadId, type: 'NOTE', content: 'Test note content' },
  }, { user: ownerUser });
  assert(activityResult.id, 'createActivity returns ID');
  assertEqual(activityResult.type, 'NOTE', 'createActivity stores type');
  assertEqual(activityResult.content, 'Test note content', 'createActivity stores content');

  // Test: createActivity for CALL
  const callActivity = resolvers.Mutation.createActivity(null, {
    input: { leadId, type: 'CALL', content: 'Called the client, discussed requirements' },
  }, { user: ownerUser });
  assertEqual(callActivity.type, 'CALL', 'createActivity supports CALL type');

  // Test: Activity.user resolver
  const actUser = resolvers.Activity.user(callActivity);
  assert(actUser !== null, 'Activity.user resolves user');

  // ════════════════════════════════
  // QUOTATION TESTS
  // ════════════════════════════════
  console.log('\n── Quotation Tests ──');

  // Test: createQuotation
  const q1 = resolvers.Mutation.createQuotation(null, {
    input: { leadId, amount: 1500000 },
  }, { user: ownerUser });
  assert(q1.id, 'createQuotation returns ID');
  assertEqual(q1.version, 1, 'first quotation is version 1');
  assert(q1.amount === 1500000, 'createQuotation stores amount');

  // Test: createQuotation (2nd version)
  const q2 = resolvers.Mutation.createQuotation(null, {
    input: { leadId, amount: 1600000 },
  }, { user: ownerUser });
  assertEqual(q2.version, 2, 'second quotation is version 2');

  // Test: quotations resolver on Lead
  const leadQuotations = resolvers.Lead.quotations({ id: leadId });
  assert(leadQuotations.length >= 2, 'Lead.quotations returns all quotations');

  // ════════════════════════════════
  // FILE TESTS
  // ════════════════════════════════
  console.log('\n── File Tests ──');

  // Test: uploadFile
  const fileResult = resolvers.Mutation.uploadFile(null, {
    input: {
      leadId,
      fileName: 'test-floor-plan.pdf',
      fileUrl: '/uploads/test-floor-plan.pdf',
      fileType: 'application/pdf',
      subCategory: 'FLOOR_PLANS',
    },
  }, { user: ownerUser });
  assert(fileResult.id, 'uploadFile returns ID');
  assertEqual(fileResult.fileName || fileResult.filename, 'test-floor-plan.pdf', 'uploadFile stores fileName');
  assertEqual(fileResult.subCategory, 'FLOOR_PLANS', 'uploadFile stores subCategory');

  // Test: uploadFile with different sub-categories
  const fileGeneral = resolvers.Mutation.uploadFile(null, {
    input: { leadId, fileName: 'general.pdf', fileUrl: '/uploads/general.pdf', subCategory: 'GENERAL' },
  }, { user: ownerUser });
  assertEqual(fileGeneral.subCategory, 'GENERAL', 'uploadFile stores GENERAL subCategory');

  const fileRef = resolvers.Mutation.uploadFile(null, {
    input: { leadId, fileName: 'ref.jpg', fileUrl: '/uploads/ref.jpg', subCategory: 'REFERENCE_IMAGES' },
  }, { user: ownerUser });
  assertEqual(fileRef.subCategory, 'REFERENCE_IMAGES', 'uploadFile stores REFERENCE_IMAGES subCategory');

  // Test: files query
  const filesResult = resolvers.Query.files(null, { leadId }, { user: ownerUser });
  assert(Array.isArray(filesResult) && filesResult.length >= 3, 'files query returns files for lead');

  // Test: files query with subCategory filter
  const floorPlanFiles = resolvers.Query.files(null, { leadId, subCategory: 'FLOOR_PLANS' }, { user: ownerUser });
  assert(floorPlanFiles.length >= 1, 'files query filters by subCategory');
  assert(floorPlanFiles.every(f => f.subCategory === 'FLOOR_PLANS'), 'all returned files match subCategory');

  // Test: File.fileName resolver
  const fileRow = { filename: 'test.pdf', uploaded_by: ownerId };
  assertEqual(resolvers.File.fileName(fileRow), 'test.pdf', 'File.fileName resolves from filename column');

  // Test: deleteFile
  const deleteFileResult = resolvers.Mutation.deleteFile(null, { id: fileResult.id }, { user: ownerUser });
  assertEqual(deleteFileResult, true, 'deleteFile returns true');
  const afterFileDelete = testDb.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.id);
  assert(!afterFileDelete, 'deleteFile removes file from DB');

  // Test: deleteFile throws for non-existent file
  assertThrows(() => resolvers.Mutation.deleteFile(null, { id: 'non-existent' }, { user: ownerUser }), 'deleteFile throws for non-existent file');

  // ════════════════════════════════
  // COLUMN PREFERENCES TESTS
  // ════════════════════════════════
  console.log('\n── Column Preferences Tests ──');

  // Test: saveColumnPreferences
  const prefResult = resolvers.Mutation.saveColumnPreferences(null, {
    columns: ['name', 'company', 'status', 'priority', 'budget', 'campaignName'],
  }, { user: ownerUser });
  assert(prefResult.id === ownerId, 'saveColumnPreferences returns correct user');
  // Check the DB directly
  const userRow = testDb.prepare('SELECT leads_column_preferences FROM users WHERE id = ?').get(ownerId);
  const savedPrefs = JSON.parse(userRow.leads_column_preferences);
  assertIncludes(savedPrefs, 'campaignName', 'column preferences include campaignName');
  assertIncludes(savedPrefs, 'budget', 'column preferences include budget');
  assert(savedPrefs.length === 6, 'column preferences saved correct count');

  // Test: User.leadsColumnPreferences resolver
  const resolvedPrefs = resolvers.User.leadsColumnPreferences({ leads_column_preferences: JSON.stringify(['name', 'status']) });
  assert(Array.isArray(resolvedPrefs) && resolvedPrefs.length === 2, 'User.leadsColumnPreferences resolves JSON');

  const resolvedNullPrefs = resolvers.User.leadsColumnPreferences({});
  assert(resolvedNullPrefs === null, 'User.leadsColumnPreferences returns null for missing');

  // ════════════════════════════════
  // USER MANAGEMENT TESTS
  // ════════════════════════════════
  console.log('\n── User Management Tests ──');

  // Test: createUser
  const newUser = resolvers.Mutation.createUser(null, {
    email: 'new@test.com', name: 'New User', role: 'SALES_EXECUTIVE', reportsTo: smId,
  }, { user: ownerUser });
  assert(newUser.id, 'createUser returns ID');
  assertEqual(newUser.email, 'new@test.com', 'createUser stores email');
  assertEqual(newUser.role, 'SALES_EXECUTIVE', 'createUser stores role');

  // Test: createUser throws for non-OWNER
  assertThrows(() => resolvers.Mutation.createUser(null, {
    email: 'x@x.com', name: 'X', role: 'SALES_EXECUTIVE',
  }, { user: seUser }), 'createUser throws for non-OWNER');

  // Test: updateOrgStructure
  const orgUpdate = resolvers.Mutation.updateOrgStructure(null, {
    userId: newUser.id, reportsTo: ownerId, role: 'SENIOR_MANAGER',
  }, { user: ownerUser });
  assertEqual(orgUpdate.role, 'SENIOR_MANAGER', 'updateOrgStructure updates role');

  // ════════════════════════════════
  // DASHBOARD TESTS
  // ════════════════════════════════
  console.log('\n── Dashboard Tests ──');

  // Seed alert settings for dashboard
  testDb.prepare("INSERT INTO alert_settings (id, setting_key, setting_value, updated_by) VALUES (?, ?, ?, ?)").run(uuidv4(), 'unattended_days', '3', ownerId);
  testDb.prepare("INSERT INTO alert_settings (id, setting_key, setting_value, updated_by) VALUES (?, ?, ?, ?)").run(uuidv4(), 'max_quote_revisions', '3', ownerId);
  testDb.prepare("INSERT INTO alert_settings (id, setting_key, setting_value, updated_by) VALUES (?, ?, ?, ?)").run(uuidv4(), 'sql_lead_inactive_days', '5', ownerId);
  testDb.prepare("INSERT INTO alert_settings (id, setting_key, setting_value, updated_by) VALUES (?, ?, ?, ?)").run(uuidv4(), 'min_calls_threshold', '3', ownerId);

  // Test: dashboardMetrics
  const dashboard = resolvers.Query.dashboardMetrics(null, null, { user: ownerUser });
  assert(typeof dashboard.totalLeads === 'number', 'dashboard returns totalLeads');
  assert(typeof dashboard.newLeads === 'number', 'dashboard returns newLeads');
  assert(Array.isArray(dashboard.pipelineStages), 'dashboard returns pipelineStages');
  assert(Array.isArray(dashboard.alerts), 'dashboard returns alerts');
  assert(dashboard.performanceMetrics !== undefined, 'dashboard returns performanceMetrics');
  assert(typeof dashboard.performanceMetrics.conversionRate === 'number', 'dashboard has conversionRate');
  assert(Array.isArray(dashboard.performanceMetrics.weeklyTrend), 'dashboard has weeklyTrend');
  assert(Array.isArray(dashboard.performanceMetrics.sourceBreakdown), 'dashboard has sourceBreakdown');
  assert(Array.isArray(dashboard.performanceMetrics.teamRanking), 'dashboard has teamRanking');

  // Test: dashboardMetrics throws for SE
  assertThrows(() => resolvers.Query.dashboardMetrics(null, null, { user: seUser }), 'dashboardMetrics throws for SE');

  // ════════════════════════════════
  // EDGE CASE TESTS
  // ════════════════════════════════
  console.log('\n── Edge Case Tests ──');

  // Test: createLead with no optional fields
  const minimalLead = resolvers.Mutation.createLead(null, {
    input: { firstName: 'Minimal' },
  }, { user: ownerUser });
  assert(minimalLead.id, 'createLead works with only firstName');
  assertEqual(minimalLead.status, 'NEW', 'minimal lead defaults to NEW status');

  // Test: Lead.assignedTo handles null
  const assignedNull = resolvers.Lead.assignedTo({ assignedTo: null, assigned_to: null });
  assert(assignedNull === null, 'Lead.assignedTo returns null for unassigned');

  // Test: Lead.campaignActive handles null
  const nullCampaign = resolvers.Lead.campaignActive({ campaignActive: null });
  assert(nullCampaign === null, 'Lead.campaignActive returns null for null');

  // Test: Lead.propertyInPossession handles 0
  const noProperty = resolvers.Lead.propertyInPossession({ propertyInPossession: 0 });
  assertEqual(noProperty, false, 'Lead.propertyInPossession converts 0 to false');

  // Test: Lead.propertyInPossession with null input returns false
  const nullProperty = resolvers.Lead.propertyInPossession({ propertyInPossession: null });
  assertEqual(nullProperty, false, 'Lead.propertyInPossession with null returns false');

  // Test: sort by budget
  const budgetSorted = resolvers.Query.leads(null, {
    filters: {}, limit: 50, offset: 0, sortBy: 'budget', sortOrder: 'DESC',
  }, { user: ownerUser });
  assert(budgetSorted.leads.length >= 1, 'leads sorted by budget returns results');

  // Test: invalid sort column falls back to created_at
  const invalidSort = resolvers.Query.leads(null, {
    filters: {}, limit: 50, offset: 0, sortBy: 'DROP TABLE leads;--', sortOrder: 'DESC',
  }, { user: ownerUser });
  assert(invalidSort.leads.length >= 1, 'invalid sort column safely falls back');

  // Test: pagination
  const page1 = resolvers.Query.leads(null, { filters: {}, limit: 2, offset: 0 }, { user: ownerUser });
  const page2 = resolvers.Query.leads(null, { filters: {}, limit: 2, offset: 2 }, { user: ownerUser });
  assert(page1.leads.length <= 2, 'pagination limit works');
  if (page1.totalCount > 2) {
    assert(page1.leads[0].id !== page2.leads[0]?.id, 'pagination offset works - different results');
  }

  // ════════════════════════════════
  // RESULTS
  // ════════════════════════════════
  console.log('\n\n' + '═'.repeat(50));
  console.log(`\n✅ Passed: ${passCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
    console.log('\nFailures:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log(`\nTotal: ${passCount + failCount} tests\n`);

  // Cleanup
  testDb.close();
  fs.unlinkSync(TEST_DB_PATH);

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('\n💥 Test runner crashed:', err);
  testDb.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.exit(1);
});
