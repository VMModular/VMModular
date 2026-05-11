require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const depthLimit = require('graphql-depth-limit');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { getContextUser, verifyToken } = require('./auth/auth');
const calendarService = require('./services/googleCalendar');
const db = require('./db/pool');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const XLSX = require('xlsx');

// ── Data Management: column definitions ──
const EXPORT_COLS = [
  { key: 'id', label: 'ID' },
  { key: 'first_name', label: 'First Name' },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'company', label: 'Company' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'source', label: 'Source' },
  { key: 'campaign_name', label: 'Campaign Name' },
  { key: 'campaign_active', label: 'Campaign Active' },
  { key: 'assigned_to_name', label: 'Assigned To' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'delivery_days', label: 'Delivery Days' },
  { key: 'property_in_possession', label: 'Property In Possession' },
  { key: 'expected_handover_month', label: 'Expected Handover Month' },
  { key: 'expected_handover_year', label: 'Expected Handover Year' },
  { key: 'current_living_area', label: 'Current Living Area' },
  { key: 'current_living_city', label: 'Current Living City' },
  { key: 'current_living_country', label: 'Current Living Country' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created At' },
];

const IMPORT_TEMPLATE_COLS = [
  'First Name', 'Middle Name', 'Last Name', 'Designation', 'Company', 'Email', 'Phone',
  'Status', 'Priority', 'Source', 'Campaign Name', 'Campaign Active',
  'Budget', 'Location', 'Delivery Days', 'Property In Possession',
  'Expected Handover Month', 'Expected Handover Year',
  'Current Living Area', 'Current Living City', 'Current Living Country', 'Notes',
];

const IMPORT_KEY_MAP = {
  'firstname': 'firstName', 'middlename': 'middleName', 'lastname': 'lastName',
  'designation': 'designation', 'company': 'company', 'email': 'email', 'phone': 'phone',
  'status': 'status', 'priority': 'priority', 'source': 'source',
  'campaignname': 'campaignName', 'campaignactive': 'campaignActive',
  'budget': 'budget', 'location': 'location', 'deliverydays': 'deliveryDays',
  'propertyinpossession': 'propertyInPossession',
  'expectedhandovermonth': 'expectedHandoverMonth', 'expectedhandoveryear': 'expectedHandoverYear',
  'currentlivingarea': 'currentLivingArea', 'currentlivingcity': 'currentLivingCity',
  'currentlivingcountry': 'currentLivingCountry', 'notes': 'notes',
};

const VALID_STATUSES = new Set(['NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK']);
const VALID_PRIORITIES = new Set(['P1', 'P2', 'P3']);
const VALID_SOURCES = new Set(['REPEAT', 'INSTAGRAM', 'FB_ADS', 'GOOGLE_ADS', 'META_ADS', 'WALK_IN', 'REFERRAL', 'WEBSITE_ENQUIRY']);
const VALID_DESIGNATIONS = new Set(['MR', 'MRS', 'DR', 'AR']);

function parseBoolImport(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).toLowerCase().trim();
  if (s === '1' || s === 'true' || s === 'yes') return 1;
  if (s === '0' || s === 'false' || s === 'no') return 0;
  return null;
}

// ── Data Management: auth middleware ──
function checkDataAccess(roles) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });
    const row = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id);
    if (!row) return res.status(401).json({ error: 'User not found or inactive' });
    if (!roles.includes(row.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    req.dbUser = row;
    next();
  };
}

// ── Multer: file upload for import ──
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.xlsx')) return cb(null, true);
    cb(new Error('Only .csv and .xlsx files are accepted'));
  },
});

const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

async function startServer() {
  const app = express();

  // ── Trust proxy (running behind nginx/Caddy) ──
  app.set('trust proxy', 1);

  // ── Security Headers ──
  app.use(helmet({
    contentSecurityPolicy: IS_PROD ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS – allow-list origins ──
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  // ── Rate Limiting ──
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PROD ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/graphql', apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PROD ? 20 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later.' },
  });
  app.use('/auth', authLimiter);

  // ── Health Check (with DB ping) ──
  app.get('/health', (_, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
  });

  // ── Google OAuth config for frontend ──
  app.get('/auth/google/client-id', (_, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured' });
    }
    return res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
  });

  // ── Google Calendar OAuth callback ──
  app.get('/auth/google/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) {
      return res.status(400).send('Missing code or state');
    }
    try {
      await calendarService.handleCallback(code, userId);
      res.redirect(`${ALLOWED_ORIGINS[0]}/settings?calendar=connected`);
    } catch (err) {
      console.error('Calendar OAuth callback error:', err);
      res.redirect(`${ALLOWED_ORIGINS[0]}/settings?calendar=error`);
    }
  });

  // ── Data Management Rate Limiter ──
  const dataLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PROD ? 15 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  // ── Backup: full JSON download (OWNER only) ──
  app.get('/api/leads/backup', dataLimiter, checkDataAccess(['OWNER']), (req, res) => {
    try {
      const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
      const contacts = db.prepare('SELECT * FROM lead_contacts ORDER BY lead_id, contact_order').all();
      const activities = db.prepare('SELECT * FROM activities ORDER BY lead_id, created_at DESC').all();
      const quotations = db.prepare('SELECT * FROM quotations ORDER BY lead_id, version').all();

      const dateStr = new Date().toISOString().split('T')[0];
      const backup = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.dbUser.email,
        version: '1.0',
        counts: { leads: leads.length, contacts: contacts.length, activities: activities.length, quotations: quotations.length },
        data: { leads, contacts, activities, quotations },
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="vmcrm-backup-${dateStr}.json"`);
      res.json(backup);
    } catch (err) {
      console.error('Backup error:', err);
      res.status(500).json({ error: 'Failed to generate backup' });
    }
  });

  // ── Export: CSV or XLSX download (OWNER + SENIOR_MANAGER) ──
  app.get('/api/leads/export', dataLimiter, checkDataAccess(['OWNER', 'SENIOR_MANAGER']), (req, res) => {
    try {
      const format = (String(req.query.format || 'xlsx')).toLowerCase();
      if (format !== 'csv' && format !== 'xlsx') {
        return res.status(400).json({ error: 'Format must be csv or xlsx' });
      }

      const rows = db.prepare(
        `SELECT l.*, u.name AS assigned_to_name
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ORDER BY l.created_at DESC`
      ).all();

      const data = rows.map(r => {
        const obj = {};
        for (const col of EXPORT_COLS) {
          let val = r[col.key];
          if (col.key === 'campaign_active' || col.key === 'property_in_possession') {
            val = val === 1 ? 'Yes' : val === 0 ? 'No' : '';
          }
          obj[col.label] = val ?? '';
        }
        return obj;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(ws);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${dateStr}.csv"`);
        res.send('\uFEFF' + csv); // BOM prefix for Excel UTF-8 compatibility
      } else {
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${dateStr}.xlsx"`);
        res.send(buffer);
      }
    } catch (err) {
      console.error('Export error:', err);
      res.status(500).json({ error: 'Failed to export leads' });
    }
  });

  // ── Import Template download (OWNER + SENIOR_MANAGER) ──
  app.get('/api/leads/import-template', dataLimiter, checkDataAccess(['OWNER', 'SENIOR_MANAGER']), (_req, res) => {
    try {
      const sample = [{
        'First Name': 'John', 'Middle Name': '', 'Last Name': 'Doe', 'Designation': 'MR',
        'Company': 'ABC Corp', 'Email': 'john@example.com', 'Phone': '+91 9000000000',
        'Status': 'NEW', 'Priority': 'P2', 'Source': 'WALK_IN',
        'Campaign Name': '', 'Campaign Active': '',
        'Budget': 2500000, 'Location': 'Hyderabad', 'Delivery Days': 60,
        'Property In Possession': 'No', 'Expected Handover Month': 6, 'Expected Handover Year': 2026,
        'Current Living Area': 'Banjara Hills', 'Current Living City': 'Hyderabad',
        'Current Living Country': 'India', 'Notes': 'Sample note — delete this row before importing',
      }];

      const ws = XLSX.utils.json_to_sheet(sample, { header: IMPORT_TEMPLATE_COLS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads Import Template');

      const wsNotes = XLSX.utils.json_to_sheet([
        { Column: 'First Name', Required: 'YES', 'Allowed Values / Notes': 'Free text' },
        { Column: 'Designation', Required: 'No', 'Allowed Values / Notes': 'MR | MRS | DR | AR' },
        { Column: 'Status', Required: 'No', 'Allowed Values / Notes': 'NEW | FOLLOW_UP | MQL | SQL | MUQL | QUOTED | WON | JUNK (defaults to NEW)' },
        { Column: 'Priority', Required: 'No', 'Allowed Values / Notes': 'P1 | P2 | P3 (defaults to P3)' },
        { Column: 'Source', Required: 'No', 'Allowed Values / Notes': 'REPEAT | INSTAGRAM | FB_ADS | GOOGLE_ADS | META_ADS | WALK_IN | REFERRAL | WEBSITE_ENQUIRY' },
        { Column: 'Campaign Active', Required: 'No', 'Allowed Values / Notes': 'Yes | No | true | false | 1 | 0' },
        { Column: 'Budget', Required: 'No', 'Allowed Values / Notes': 'Numeric value (e.g. 2500000)' },
        { Column: 'Delivery Days', Required: 'No', 'Allowed Values / Notes': 'Integer (number of days)' },
        { Column: 'Property In Possession', Required: 'No', 'Allowed Values / Notes': 'Yes | No | true | false | 1 | 0' },
        { Column: 'Expected Handover Month', Required: 'No', 'Allowed Values / Notes': '1–12' },
        { Column: 'Expected Handover Year', Required: 'No', 'Allowed Values / Notes': 'Four-digit year (e.g. 2026)' },
      ]);
      XLSX.utils.book_append_sheet(wb, wsNotes, 'Field Notes');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leads-import-template.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('Template error:', err);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  });

  // ── Import: bulk lead creation from CSV/XLSX (OWNER + SENIOR_MANAGER) ──
  app.post(
    '/api/leads/import',
    dataLimiter,
    checkDataAccess(['OWNER', 'SENIOR_MANAGER']),
    importUpload.single('file'),
    (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      try {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawRows.length === 0) return res.status(400).json({ error: 'The file is empty or has no data rows' });
        if (rawRows.length > 1000) return res.status(400).json({ error: 'Import is limited to 1000 rows at a time' });

        const results = { imported: 0, skipped: 0, errors: [] };

        const insertLead = db.prepare(
          `INSERT INTO leads (
            id, name, designation, first_name, middle_name, last_name, company, email, phone,
            status, priority, source, campaign_name, campaign_active,
            budget, location, delivery_days, property_in_possession,
            expected_handover_month, expected_handover_year,
            current_living_area, current_living_city, current_living_country,
            notes, created_by, assigned_to, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, datetime('now'), datetime('now')
          )`
        );

        const doImport = db.transaction(() => {
          for (let i = 0; i < rawRows.length; i++) {
            // Normalize column header keys
            const row = {};
            for (const [k, v] of Object.entries(rawRows[i])) {
              const nk = String(k).toLowerCase().replace(/[\s\-_]+/g, '');
              const field = IMPORT_KEY_MAP[nk];
              if (field) row[field] = v;
            }

            const firstName = String(row.firstName || '').trim();
            if (!firstName) {
              results.skipped++;
              results.errors.push(`Row ${i + 2}: Missing required field "First Name" — skipped`);
              continue;
            }

            const statusUp = String(row.status || '').toUpperCase();
            const priorityUp = String(row.priority || '').toUpperCase();
            const sourceUp = String(row.source || '').toUpperCase();
            const desigUp = String(row.designation || '').toUpperCase();

            const status = VALID_STATUSES.has(statusUp) ? statusUp : 'NEW';
            const priority = VALID_PRIORITIES.has(priorityUp) ? priorityUp : 'P3';
            const source = VALID_SOURCES.has(sourceUp) ? sourceUp : null;
            const designation = VALID_DESIGNATIONS.has(desigUp) ? desigUp : null;

            const middleName = String(row.middleName || '').trim() || null;
            const lastName = String(row.lastName || '').trim() || null;
            const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');

            const budget = row.budget !== '' && !isNaN(parseFloat(row.budget)) ? parseFloat(row.budget) : null;
            const deliveryDays = row.deliveryDays !== '' && !isNaN(parseInt(row.deliveryDays)) ? parseInt(row.deliveryDays) : null;
            const propertyInPossession = parseBoolImport(row.propertyInPossession);
            const campaignActive = parseBoolImport(row.campaignActive);
            const expectedHandoverMonth = row.expectedHandoverMonth !== '' && !isNaN(parseInt(row.expectedHandoverMonth)) ? parseInt(row.expectedHandoverMonth) : null;
            const expectedHandoverYear = row.expectedHandoverYear !== '' && !isNaN(parseInt(row.expectedHandoverYear)) ? parseInt(row.expectedHandoverYear) : null;

            try {
              insertLead.run(
                uuidv4(), displayName, designation, firstName, middleName, lastName,
                String(row.company || '').trim() || null,
                String(row.email || '').trim().toLowerCase() || null,
                String(row.phone || '').trim() || null,
                status, priority, source,
                String(row.campaignName || '').trim() || null, campaignActive,
                budget,
                String(row.location || '').trim() || null,
                deliveryDays, propertyInPossession,
                expectedHandoverMonth, expectedHandoverYear,
                String(row.currentLivingArea || '').trim() || null,
                String(row.currentLivingCity || '').trim() || null,
                String(row.currentLivingCountry || '').trim() || null,
                String(row.notes || '').trim() || null,
                req.dbUser.id, req.dbUser.id
              );
              results.imported++;
            } catch (err) {
              results.skipped++;
              results.errors.push(`Row ${i + 2}: ${err.message}`);
            }
          }
        });

        doImport();
        res.json({ success: true, ...results });
      } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: 'Failed to process import file' });
      }
    }
  );

  // ── Apollo GraphQL ──
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(7)],
    introspection: !IS_PROD,
    formatError: (formattedError, error) => {
      console.error('GraphQL Error:', error);
      // Never leak internal details in production
      if (IS_PROD && !formattedError.extensions?.code) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return {
        message: formattedError.message,
        extensions: { code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR' },
      };
    },
  });

  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const user = await getContextUser(req);
      return { user };
    },
  }));

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    console.log(`🔒 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`🔒 Introspection: ${IS_PROD ? 'DISABLED' : 'enabled (dev)'}`);
    console.log(`🔒 Rate limit: ${IS_PROD ? '300' : '1000'} req/15min`);
  });
}

startServer().catch(console.error);
