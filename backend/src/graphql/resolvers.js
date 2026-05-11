const db = require('../db/pool');
const { generateToken, requireAuth, requireRole, validateLeadInput } = require('../auth/auth');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');
const calendarService = require('../services/googleCalendar');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helper: camelCase row keys ──
function toCamel(row) {
  if (!row) return null;
  const result = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
}

function toCamelArray(rows) {
  return (rows || []).map(toCamel);
}

// ── MQL/SQL Criteria Evaluation Engine ──
const CRITERIA_FIELD_MAP = {
  budget: { column: 'budget', type: 'number' },
  location: { column: 'location', type: 'string' },
  source: { column: 'source', type: 'string' },
  priority: { column: 'priority', type: 'string' },
  status: { column: 'status', type: 'string' },
  company: { column: 'company', type: 'string' },
  delivery_days: { column: 'delivery_days', type: 'number' },
  campaign_name: { column: 'campaign_name', type: 'string' },
  campaign_active: { column: 'campaign_active', type: 'boolean' },
  property_in_possession: { column: 'property_in_possession', type: 'boolean' },
  current_living_city: { column: 'current_living_city', type: 'string' },
  current_living_country: { column: 'current_living_country', type: 'string' },
};

function evaluateCriterion(leadValue, operator, criterionValue, fieldType) {
  if (leadValue === null || leadValue === undefined) return false;

  if (fieldType === 'number') {
    const lv = parseFloat(leadValue);
    const cv = parseFloat(criterionValue);
    if (isNaN(lv) || isNaN(cv)) return false;
    switch (operator) {
      case 'equals': return lv === cv;
      case 'not_equals': return lv !== cv;
      case 'greater_than': return lv > cv;
      case 'greater_than_or_equal': return lv >= cv;
      case 'less_than': return lv < cv;
      case 'less_than_or_equal': return lv <= cv;
      default: return false;
    }
  }

  if (fieldType === 'boolean') {
    const lv = leadValue === 1 || leadValue === true || leadValue === '1' || leadValue === 'true';
    const cv = criterionValue === '1' || criterionValue === 'true' || criterionValue === 'yes';
    switch (operator) {
      case 'equals': return lv === cv;
      case 'not_equals': return lv !== cv;
      default: return false;
    }
  }

  // string
  const lv = String(leadValue).toLowerCase();
  const cv = String(criterionValue).toLowerCase();
  switch (operator) {
    case 'equals': return lv === cv;
    case 'not_equals': return lv !== cv;
    case 'contains': return lv.includes(cv);
    case 'greater_than': return lv > cv;
    case 'greater_than_or_equal': return lv >= cv;
    case 'less_than': return lv < cv;
    case 'less_than_or_equal': return lv <= cv;
    default: return false;
  }
}

function evaluateLeadQualification(lead) {
  const mqlCriteria = db.prepare(
    'SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ?'
  ).all('MQL');
  const sqlCriteria = db.prepare(
    'SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ?'
  ).all('SQL');

  let matchesMQL = false;
  let matchesSQL = false;

  if (mqlCriteria.length > 0) {
    matchesMQL = mqlCriteria.every(c => {
      const mapping = CRITERIA_FIELD_MAP[c.field];
      if (!mapping) return false;
      return evaluateCriterion(lead[mapping.column], c.operator, c.value, mapping.type);
    });
  }

  if (sqlCriteria.length > 0) {
    matchesSQL = sqlCriteria.every(c => {
      const mapping = CRITERIA_FIELD_MAP[c.field];
      if (!mapping) return false;
      return evaluateCriterion(lead[mapping.column], c.operator, c.value, mapping.type);
    });
  }

  // SQL supersedes MQL
  if (matchesSQL && sqlCriteria.length > 0) return 'SQL';
  if (matchesMQL && mqlCriteria.length > 0) return 'MQL';
  return null;
}

function applyQualification(leadId, userId) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return;

  // Don't auto-qualify leads already in terminal/advanced states
  const skipStatuses = ['QUOTED', 'WON', 'JUNK', 'MUQL'];
  if (skipStatuses.includes(lead.status)) return;

  const qualified = evaluateLeadQualification(lead);

  if (qualified && lead.status !== qualified) {
    // Only upgrade: NEW/FOLLOW_UP→MQL, NEW/FOLLOW_UP/MQL→SQL
    const statusRank = { NEW: 0, FOLLOW_UP: 1, MQL: 2, SQL: 3 };
    if ((statusRank[qualified] || 0) > (statusRank[lead.status] || 0)) {
      db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").run(qualified, leadId);
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
      ).run(uuidv4(), leadId, userId,
        `Auto-qualified from ${lead.status} to ${qualified} (criteria match)`,
        JSON.stringify({ from: lead.status, to: qualified, auto: true }));
    }
  } else if (!qualified && (lead.status === 'MQL' || lead.status === 'SQL')) {
    // Lead no longer meets any criteria — revert
    db.prepare("UPDATE leads SET status = 'FOLLOW_UP', updated_at = datetime('now') WHERE id = ?").run(leadId);
    db.prepare(
      `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
    ).run(uuidv4(), leadId, userId,
      `Auto-downgraded from ${lead.status} to FOLLOW_UP (criteria no longer match)`,
      JSON.stringify({ from: lead.status, to: 'FOLLOW_UP', auto: true }));
  }
}

function reEvaluateAllLeads(userId) {
  const leads = db.prepare(
    "SELECT * FROM leads WHERE status NOT IN ('QUOTED', 'WON', 'JUNK', 'MUQL')"
  ).all();
  for (const lead of leads) {
    const qualified = evaluateLeadQualification(lead);
    const autoStatuses = ['NEW', 'FOLLOW_UP', 'MQL', 'SQL'];

    if (qualified && lead.status !== qualified && autoStatuses.includes(lead.status)) {
      // Set to the correct qualification level (upgrade or downgrade)
      db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").run(qualified, lead.id);
      const direction = qualified === 'SQL' && lead.status !== 'SQL' ? 'qualified' :
        qualified === 'MQL' && lead.status === 'SQL' ? 'adjusted' : 'qualified';
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
      ).run(uuidv4(), lead.id, userId,
        `Auto-${direction} from ${lead.status} to ${qualified} (criteria evaluation)`,
        JSON.stringify({ from: lead.status, to: qualified, auto: true }));
    } else if (!qualified && (lead.status === 'MQL' || lead.status === 'SQL')) {
      // No criteria match at all — revert to FOLLOW_UP
      db.prepare("UPDATE leads SET status = 'FOLLOW_UP', updated_at = datetime('now') WHERE id = ?").run(lead.id);
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
      ).run(uuidv4(), lead.id, userId,
        `Auto-downgraded from ${lead.status} to FOLLOW_UP (criteria no longer match)`,
        JSON.stringify({ from: lead.status, to: 'FOLLOW_UP', auto: true }));
    }
  }
}

// ── Build SQL WHERE clause from qualification criteria ──
function buildCriteriaWhereClause(criteriaType, alias) {
  const criteria = db.prepare(
    'SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ?'
  ).all(criteriaType);
  if (criteria.length === 0) return { clause: '', params: [] };

  let clause = '';
  const params = [];
  const col = (field) => alias ? `${alias}.${field}` : field;

  for (const c of criteria) {
    const mapping = CRITERIA_FIELD_MAP[c.field];
    if (!mapping) continue;
    const column = col(mapping.column);

    if (mapping.type === 'number') {
      const val = parseFloat(c.value);
      if (isNaN(val)) continue;
      switch (c.operator) {
        case 'equals': clause += ` AND ${column} = ?`; params.push(val); break;
        case 'not_equals': clause += ` AND ${column} != ?`; params.push(val); break;
        case 'greater_than': clause += ` AND ${column} > ?`; params.push(val); break;
        case 'greater_than_or_equal': clause += ` AND ${column} >= ?`; params.push(val); break;
        case 'less_than': clause += ` AND ${column} < ?`; params.push(val); break;
        case 'less_than_or_equal': clause += ` AND ${column} <= ?`; params.push(val); break;
      }
    } else if (mapping.type === 'boolean') {
      const val = c.value === 'true' || c.value === '1' || c.value === 'yes' ? 1 : 0;
      switch (c.operator) {
        case 'equals': clause += ` AND ${column} = ?`; params.push(val); break;
        case 'not_equals': clause += ` AND ${column} != ?`; params.push(val); break;
      }
    } else {
      switch (c.operator) {
        case 'equals': clause += ` AND LOWER(${column}) = LOWER(?)`; params.push(c.value); break;
        case 'not_equals': clause += ` AND LOWER(${column}) != LOWER(?)`; params.push(c.value); break;
        case 'contains': clause += ` AND LOWER(${column}) LIKE LOWER(?)`; params.push(`%${c.value}%`); break;
        case 'greater_than': clause += ` AND ${column} > ?`; params.push(c.value); break;
        case 'greater_than_or_equal': clause += ` AND ${column} >= ?`; params.push(c.value); break;
        case 'less_than': clause += ` AND ${column} < ?`; params.push(c.value); break;
        case 'less_than_or_equal': clause += ` AND ${column} <= ?`; params.push(c.value); break;
      }
    }
  }
  return { clause, params };
}

const resolvers = {
  // ── Scalar handling ──
  DateTime: {
    __serialize: (value) => (value instanceof Date ? value.toISOString() : value),
    __parseValue: (value) => new Date(value),
  },
  JSON: {
    __serialize: (value) => {
      if (typeof value === 'string') { try { return JSON.parse(value); } catch { return value; } }
      return value;
    },
    __parseValue: (value) => value,
  },

  // ── Type resolvers ──
  User: {
    reportsToId: (parent) => parent.reportsToId || parent.reportsTo || parent.reports_to || null,
    reportsTo: (parent) => {
      if (!parent.reportsToId && !parent.reportsTo && !parent.reports_to) return null;
      const id = parent.reportsToId || parent.reportsTo || parent.reports_to;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
    directReports: (parent) => {
      return toCamelArray(db.prepare('SELECT * FROM users WHERE reports_to = ? AND is_active = 1 ORDER BY name').all(parent.id));
    },
    leadsColumnPreferences: (parent) => {
      const val = parent.leadsColumnPreferences || parent.leads_column_preferences;
      if (!val) return null;
      try { return JSON.parse(val); } catch { return null; }
    },
  },

  Lead: {
    assignedTo: (parent) => {
      const id = parent.assignedToId || parent.assignedTo || parent.assigned_to;
      if (!id) return null;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
    createdBy: (parent) => {
      const id = parent.createdById || parent.createdBy || parent.created_by;
      if (!id) return null;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
    activities: (parent) => {
      return toCamelArray(db.prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC').all(parent.id));
    },
    quotations: (parent) => {
      return toCamelArray(db.prepare('SELECT * FROM quotations WHERE lead_id = ? ORDER BY version DESC').all(parent.id));
    },
    files: (parent) => {
      return toCamelArray(db.prepare('SELECT * FROM files WHERE lead_id = ? ORDER BY created_at DESC').all(parent.id));
    },
    contacts: (parent) => {
      return toCamelArray(db.prepare('SELECT * FROM lead_contacts WHERE lead_id = ? ORDER BY contact_order').all(parent.id));
    },
    propertyInPossession: (parent) => {
      const val = parent.propertyInPossession !== undefined ? parent.propertyInPossession : parent.property_in_possession;
      return val === 1 || val === true;
    },
    campaignActive: (parent) => {
      const val = parent.campaignActive !== undefined ? parent.campaignActive : parent.campaign_active;
      if (val === null || val === undefined) return null;
      return val === 1 || val === true;
    },
  },

  Activity: {
    user: (parent) => {
      const id = parent.userId || parent.user_id;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
    lead: (parent) => {
      const id = parent.leadId || parent.lead_id;
      return toCamel(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
    },
    dueDate: (parent) => parent.dueDate || parent.due_date || null,
    isCompleted: (parent) => {
      const val = parent.isCompleted !== undefined ? parent.isCompleted : parent.is_completed;
      return val === 1 || val === true;
    },
    isOverdue: (parent) => {
      const dueDate = parent.dueDate || parent.due_date;
      const isCompleted = parent.isCompleted !== undefined ? parent.isCompleted : parent.is_completed;
      if (!dueDate || isCompleted === 1 || isCompleted === true) return false;
      return new Date(dueDate) < new Date();
    },
  },

  Quotation: {
    createdBy: (parent) => {
      const id = parent.createdById || parent.created_by;
      if (!id) return null;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
  },

  File: {
    fileName: (parent) => parent.fileName || parent.filename,
    uploadedBy: (parent) => {
      const id = parent.uploadedById || parent.uploaded_by;
      if (!id) return null;
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },
  },

  // ── Queries ──
  Query: {
    me: (_, __, { user }) => {
      if (!user) return null;
      return toCamel(user);
    },

    users: (_, __, { user }) => {
      requireAuth(user);
      return toCamelArray(db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY name').all());
    },

    user: (_, { id }, { user }) => {
      requireAuth(user);
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    orgStructure: (_, __, { user }) => {
      requireAuth(user);
      return toCamelArray(db.prepare(`
        SELECT * FROM users WHERE is_active = 1 ORDER BY 
          CASE role 
            WHEN 'OWNER' THEN 1 
            WHEN 'SENIOR_MANAGER' THEN 2 
            WHEN 'PRE_SALES_MANAGER' THEN 3 
            WHEN 'SALES_EXECUTIVE' THEN 4 
            WHEN 'PRE_SALES_EXECUTIVE' THEN 5 
          END, name
      `).all());
    },

    unassignedUsers: (_, __, { user }) => {
      requireRole(user, ['OWNER']);
      return toCamelArray(
        db.prepare("SELECT * FROM users WHERE reports_to IS NULL AND role != 'OWNER' AND is_active = 1 ORDER BY name").all()
      );
    },

    leads: (_, { filters, limit = 200, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' }, { user }) => {
      requireAuth(user);

      let whereClause = 'WHERE 1=1';
      const params = [];

      // Role-based filtering
      if (['SALES_EXECUTIVE', 'PRE_SALES_EXECUTIVE'].includes(user.role)) {
        whereClause += ' AND l.assigned_to = ?';
        params.push(user.id);
      } else if (['SENIOR_MANAGER', 'PRE_SALES_MANAGER'].includes(user.role)) {
        whereClause += ' AND (l.assigned_to = ? OR l.assigned_to IN (SELECT id FROM users WHERE reports_to = ?))';
        params.push(user.id, user.id);
      }

      // Apply filters
      if (filters) {
        if (filters.status) {
          whereClause += ' AND l.status = ?';
          params.push(filters.status);
        }
        if (filters.priority) {
          whereClause += ' AND l.priority = ?';
          params.push(filters.priority);
        }
        if (filters.source) {
          whereClause += ' AND l.source = ?';
          params.push(filters.source);
        }
        if (filters.assignedTo) {
          whereClause += ' AND l.assigned_to = ?';
          params.push(filters.assignedTo);
        }
        if (filters.search) {
          whereClause += ' AND (l.first_name LIKE ? OR l.last_name LIKE ? OR l.company LIKE ? OR l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
          const s = `%${filters.search}%`;
          params.push(s, s, s, s, s, s);
        }
        if (filters.noActivityDays) {
          whereClause += ' AND l.updated_at < datetime(\'now\', ? || \' days\')';
          params.push(-Math.abs(filters.noActivityDays));
        }
        if (filters.budgetMin !== undefined && filters.budgetMin !== null) {
          whereClause += ' AND l.budget >= ?';
          params.push(filters.budgetMin);
        }
        if (filters.budgetMax !== undefined && filters.budgetMax !== null) {
          whereClause += ' AND l.budget <= ?';
          params.push(filters.budgetMax);
        }
        if (filters.location) {
          whereClause += ' AND l.location LIKE ?';
          params.push(`%${filters.location}%`);
        }
        if (filters.propertyInPossession !== undefined && filters.propertyInPossession !== null) {
          whereClause += ' AND l.property_in_possession = ?';
          params.push(filters.propertyInPossession ? 1 : 0);
        }
        if (filters.campaignName) {
          whereClause += ' AND l.campaign_name LIKE ?';
          params.push(`%${filters.campaignName}%`);
        }
        if (filters.campaignActive !== undefined && filters.campaignActive !== null) {
          whereClause += ' AND l.campaign_active = ?';
          params.push(filters.campaignActive ? 1 : 0);
        }
        if (filters.createdAfter) {
          whereClause += ' AND l.created_at >= ?';
          params.push(filters.createdAfter);
        }
        if (filters.createdBefore) {
          whereClause += ' AND l.created_at <= ?';
          params.push(filters.createdBefore);
        }
        if (filters.matchesCriteria) {
          const critMatch = buildCriteriaWhereClause(filters.matchesCriteria, 'l');
          whereClause += critMatch.clause;
          params.push(...critMatch.params);
        }
      }

      // Allowed sort columns
      const allowedSorts = ['created_at', 'updated_at', 'first_name', 'name', 'company', 'status', 'priority', 'budget'];
      const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
      const safeOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

      const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM leads l ${whereClause}`).get(...params);
      const totalCount = countRow.cnt;

      const rows = db.prepare(
        `SELECT l.* FROM leads l ${whereClause} ORDER BY l.${safeSort} ${safeOrder} LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);

      return {
        leads: toCamelArray(rows),
        totalCount,
      };
    },

    lead: (_, { id }, { user }) => {
      requireAuth(user);
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) throw new Error('Lead not found');

      if (['SALES_EXECUTIVE', 'PRE_SALES_EXECUTIVE'].includes(user.role) && lead.assigned_to !== user.id) {
        throw new Error('Access denied');
      }

      return toCamel(lead);
    },

    activities: (_, { leadId, limit = 50, offset = 0 }, { user }) => {
      requireAuth(user);
      return toCamelArray(
        db.prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(leadId, limit, offset)
      );
    },

    quotations: (_, { leadId }, { user }) => {
      requireAuth(user);
      return toCamelArray(
        db.prepare('SELECT * FROM quotations WHERE lead_id = ? ORDER BY version DESC').all(leadId)
      );
    },

    files: (_, { leadId, subCategory }, { user }) => {
      requireAuth(user);
      let sql = 'SELECT * FROM files WHERE lead_id = ?';
      const params = [leadId];
      if (subCategory) {
        sql += ' AND sub_category = ?';
        params.push(subCategory);
      }
      sql += ' ORDER BY created_at DESC';
      return toCamelArray(db.prepare(sql).all(...params));
    },

    dashboardMetrics: (_, __, { user }) => {
      requireRole(user, ['OWNER', 'SENIOR_MANAGER', 'PRE_SALES_MANAGER']);

      let teamFilter = '';
      const params = [];
      if (['SENIOR_MANAGER', 'PRE_SALES_MANAGER'].includes(user.role)) {
        teamFilter = `WHERE assigned_to = ? OR assigned_to IN (SELECT id FROM users WHERE reports_to = ?)`;
        params.push(user.id, user.id);
      }

      const statusCounts = db.prepare(
        `SELECT status, COUNT(*) as count FROM leads ${teamFilter} GROUP BY status`
      ).all(...params);

      const statusMap = {};
      statusCounts.forEach((r) => { statusMap[r.status] = r.count; });

      const bookedRow = db.prepare(
        `SELECT COALESCE(SUM(budget), 0) as total FROM leads ${teamFilter ? teamFilter + " AND status = 'WON'" : "WHERE status = 'WON'"}`
      ).get(...params);

      // Pipeline stages
      const pipelineStages = [
        { stage: 'New', count: statusMap['NEW'] || 0 },
        { stage: 'MQL', count: statusMap['MQL'] || 0 },
        { stage: 'SQL', count: statusMap['SQL'] || 0 },
        { stage: 'Quoted', count: statusMap['QUOTED'] || 0 },
        { stage: 'Won', count: statusMap['WON'] || 0 },
      ];

      // Team performance
      const isManager = ['SENIOR_MANAGER', 'PRE_SALES_MANAGER'].includes(user.role);
      const teamParams = isManager ? [user.id] : [];
      const teamRows = db.prepare(`
        SELECT u.id as user_id, u.name as user_name,
          SUM(CASE WHEN l.status = 'NEW' THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN l.status = 'MQL' THEN 1 ELSE 0 END) as mql_count,
          SUM(CASE WHEN l.status = 'SQL' THEN 1 ELSE 0 END) as sql_count,
          SUM(CASE WHEN l.status = 'QUOTED' THEN 1 ELSE 0 END) as quoted_count,
          SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END) as won_count
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.created_at >= datetime('now', '-30 days')
        WHERE u.is_active = 1 AND u.role IN ('SALES_EXECUTIVE', 'PRE_SALES_EXECUTIVE')
        ${isManager ? 'AND u.reports_to = ?' : ''}
        GROUP BY u.id, u.name
        ORDER BY u.name
      `).all(...teamParams);

      // Alerts (enhanced)
      const alerts = [];
      const alertRows = db.prepare('SELECT * FROM alert_settings').all();
      const settingsMap = {};
      alertRows.forEach((r) => { settingsMap[r.setting_key] = r.setting_value; });

      // 1. Unattended leads
      const unattendedDays = parseInt(settingsMap['unattended_leads_days'] || '3');
      const unattendedParams = isManager ? [user.id, user.id] : [];
      const unattendedRows = db.prepare(`
        SELECT l.id FROM leads l
        WHERE l.status NOT IN ('WON', 'JUNK')
        AND l.updated_at < datetime('now', '-${unattendedDays} days')
        ${teamFilter ? 'AND (' + teamFilter.replace('WHERE ', '') + ')' : ''}
      `).all(...unattendedParams);

      if (unattendedRows.length > 0) {
        alerts.push({
          id: 'unattended',
          type: 'UNATTENDED',
          message: `${unattendedRows.length} Leads Unattended for > ${unattendedDays} Days`,
          count: unattendedRows.length,
          leadIds: unattendedRows.map((r) => r.id),
          severity: 'high',
        });
      }

      // 2. Excessive quote revisions
      const maxRevisions = parseInt(settingsMap['max_quote_revisions'] || '3');
      const revisionParams = isManager ? [user.id, user.id] : [];
      const revisionsRows = db.prepare(`
        SELECT q.lead_id, COUNT(*) as cnt FROM quotations q
        JOIN leads l ON l.id = q.lead_id
        ${teamFilter ? teamFilter : 'WHERE 1=1'}
        GROUP BY q.lead_id HAVING COUNT(*) > ${maxRevisions}
      `).all(...revisionParams);

      if (revisionsRows.length > 0) {
        alerts.push({
          id: 'revisions',
          type: 'EXCESSIVE_REVISIONS',
          message: `${revisionsRows.length} Leads with > ${maxRevisions} Quote Revisions`,
          count: revisionsRows.length,
          leadIds: revisionsRows.map((r) => r.lead_id),
          severity: 'medium',
        });
      }

      // 3. SQL leads with no activity
      const sqlInactiveDays = parseInt(settingsMap['sql_lead_inactive_days'] || '5');
      const sqlInactiveRows = db.prepare(`
        SELECT l.id FROM leads l
        WHERE l.status = 'SQL'
        AND l.updated_at < datetime('now', '-${sqlInactiveDays} days')
        ${teamFilter ? 'AND (' + teamFilter.replace('WHERE ', '') + ')' : ''}
      `).all(...(isManager ? [user.id, user.id] : []));

      if (sqlInactiveRows.length > 0) {
        alerts.push({
          id: 'sql_inactive',
          type: 'SQL_INACTIVE',
          message: `${sqlInactiveRows.length} SQL Leads with No Activity for > ${sqlInactiveDays} Days`,
          count: sqlInactiveRows.length,
          leadIds: sqlInactiveRows.map((r) => r.id),
          severity: 'high',
        });
      }

      // 4. Low call activity
      const minCalls = parseInt(settingsMap['min_calls_threshold'] || '3');
      const lowCallRows = db.prepare(`
        SELECT u.id as user_id, u.name, COUNT(a.id) as call_count
        FROM users u
        LEFT JOIN activities a ON a.user_id = u.id AND a.type = 'CALL' AND a.created_at >= datetime('now', '-7 days')
        WHERE u.is_active = 1 AND u.role IN ('SALES_EXECUTIVE', 'PRE_SALES_EXECUTIVE')
        ${isManager ? 'AND u.reports_to = ?' : ''}
        GROUP BY u.id, u.name
        HAVING COUNT(a.id) < ${minCalls}
      `).all(...(isManager ? [user.id] : []));

      if (lowCallRows.length > 0) {
        alerts.push({
          id: 'low_calls',
          type: 'LOW_CALL_ACTIVITY',
          message: `${lowCallRows.length} Sales Executives with < ${minCalls} Calls This Week`,
          count: lowCallRows.length,
          leadIds: [],
          severity: 'medium',
        });
      }

      // 5. High-priority leads not progressing
      const stuckP1Rows = db.prepare(`
        SELECT l.id FROM leads l
        WHERE l.priority = 'P1' AND l.status IN ('NEW', 'FOLLOW_UP')
        AND l.created_at < datetime('now', '-2 days')
        ${teamFilter ? 'AND (' + teamFilter.replace('WHERE ', '') + ')' : ''}
      `).all(...(isManager ? [user.id, user.id] : []));

      if (stuckP1Rows.length > 0) {
        alerts.push({
          id: 'stuck_p1',
          type: 'STUCK_P1',
          message: `${stuckP1Rows.length} P1 Leads Not Progressed in 2+ Days`,
          count: stuckP1Rows.length,
          leadIds: stuckP1Rows.map((r) => r.id),
          severity: 'critical',
        });
      }

      // Performance Metrics
      const totalAll = Object.values(statusMap).reduce((a, b) => a + b, 0);
      const wonCount = statusMap['WON'] || 0;
      const conversionRate = totalAll > 0 ? (wonCount / totalAll) * 100 : 0;

      const avgDealRow = db.prepare(
        `SELECT COALESCE(AVG(budget), 0) as avg_deal FROM leads ${teamFilter ? teamFilter + " AND status = 'WON'" : "WHERE status = 'WON'"}`
      ).get(...params);

      // Weekly trend (last 8 weeks)
      const weeklyTrendRows = db.prepare(`
        SELECT 
          strftime('%Y-W%W', created_at) as week,
          COUNT(*) as new_leads,
          SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) as won_leads,
          SUM(CASE WHEN status = 'WON' THEN COALESCE(budget, 0) ELSE 0 END) as revenue
        FROM leads
        ${teamFilter ? teamFilter + " AND created_at >= datetime('now', '-56 days')" : "WHERE created_at >= datetime('now', '-56 days')"}
        GROUP BY week ORDER BY week
      `).all(...params);

      // Daily trend (last 30 days)
      const dailyTrendRows = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', created_at) as day,
          COUNT(*) as new_leads,
          SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) as won_leads,
          SUM(CASE WHEN status = 'WON' THEN COALESCE(budget, 0) ELSE 0 END) as revenue
        FROM leads
        ${teamFilter ? teamFilter + " AND created_at >= datetime('now', '-30 days')" : "WHERE created_at >= datetime('now', '-30 days')"}
        GROUP BY day ORDER BY day
      `).all(...params);

      // Source breakdown
      const sourceRows = db.prepare(`
        SELECT 
          COALESCE(source, 'UNKNOWN') as source,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) as won_count,
          SUM(CASE WHEN status = 'WON' THEN COALESCE(budget, 0) ELSE 0 END) as revenue
        FROM leads
        ${teamFilter || 'WHERE 1=1'}
        GROUP BY source ORDER BY count DESC
      `).all(...params);

      // Team ranking
      const teamRankingRows = db.prepare(`
        SELECT u.id as user_id, u.name as user_name,
          COUNT(l.id) as total_leads,
          SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END) as won_leads,
          SUM(CASE WHEN l.status = 'WON' THEN COALESCE(l.budget, 0) ELSE 0 END) as revenue
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id
        WHERE u.is_active = 1 AND u.role IN ('SALES_EXECUTIVE', 'PRE_SALES_EXECUTIVE')
        ${isManager ? 'AND u.reports_to = ?' : ''}
        GROUP BY u.id, u.name
        ORDER BY won_leads DESC, revenue DESC
      `).all(...(isManager ? [user.id] : []));

      const performanceMetrics = {
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgDealSize: parseFloat(avgDealRow.avg_deal) || 0,
        avgTimeToClose: 0,
        weeklyTrend: weeklyTrendRows.map((r) => ({
          week: r.week,
          newLeads: r.new_leads,
          wonLeads: r.won_leads,
          revenue: r.revenue || 0,
        })),
        dailyTrend: dailyTrendRows.map((r) => ({
          day: r.day,
          newLeads: r.new_leads,
          wonLeads: r.won_leads,
          revenue: r.revenue || 0,
        })),
        sourceBreakdown: sourceRows.map((r) => ({
          source: r.source,
          count: r.count,
          wonCount: r.won_count || 0,
          revenue: r.revenue || 0,
        })),
        teamRanking: teamRankingRows.map((r) => ({
          userId: r.user_id,
          userName: r.user_name,
          totalLeads: r.total_leads || 0,
          wonLeads: r.won_leads || 0,
          conversionRate: r.total_leads > 0 ? Math.round((r.won_leads / r.total_leads) * 10000) / 100 : 0,
          revenue: r.revenue || 0,
        })),
      };

      // Overdue tasks
      const overdueTaskRows = toCamelArray(db.prepare(`
        SELECT a.* FROM activities a
        JOIN leads l ON l.id = a.lead_id
        WHERE a.type = 'TASK' AND a.is_completed = 0 AND a.due_date < datetime('now')
        ${teamFilter ? 'AND (' + teamFilter.replace('WHERE ', '').replace(/assigned_to/g, 'l.assigned_to') + ')' : ''}
        ORDER BY a.due_date ASC
      `).all(...(user.role === 'SENIOR_MANAGER' ? [user.id, user.id] : [])));

      // Criteria-based counts for MQL/SQL tiles
      const mqlCrit = buildCriteriaWhereClause('MQL', '');
      let mqlLeadsCount = statusMap['MQL'] || 0;
      if (mqlCrit.clause) {
        let mqlWhere = 'WHERE 1=1';
        let mqlParams = [];
        if (user.role === 'SENIOR_MANAGER') {
          mqlWhere += ' AND (assigned_to = ? OR assigned_to IN (SELECT id FROM users WHERE reports_to = ?))';
          mqlParams.push(user.id, user.id);
        }
        mqlWhere += mqlCrit.clause;
        mqlParams.push(...mqlCrit.params);
        mqlLeadsCount = db.prepare(`SELECT COUNT(*) as cnt FROM leads ${mqlWhere}`).get(...mqlParams).cnt;
      }

      const sqlCrit = buildCriteriaWhereClause('SQL', '');
      let sqlLeadsCount = statusMap['SQL'] || 0;
      if (sqlCrit.clause) {
        let sqlWhere = 'WHERE 1=1';
        let sqlParams = [];
        if (user.role === 'SENIOR_MANAGER') {
          sqlWhere += ' AND (assigned_to = ? OR assigned_to IN (SELECT id FROM users WHERE reports_to = ?))';
          sqlParams.push(user.id, user.id);
        }
        sqlWhere += sqlCrit.clause;
        sqlParams.push(...sqlCrit.params);
        sqlLeadsCount = db.prepare(`SELECT COUNT(*) as cnt FROM leads ${sqlWhere}`).get(...sqlParams).cnt;
      }

      return {
        totalLeads: Object.values(statusMap).reduce((a, b) => a + b, 0),
        newLeads: statusMap['NEW'] || 0,
        mqlLeads: mqlLeadsCount,
        sqlLeads: sqlLeadsCount,
        quotedLeads: statusMap['QUOTED'] || 0,
        wonLeads: statusMap['WON'] || 0,
        bookedOrdersValue: parseFloat(bookedRow.total),
        pipelineStages,
        teamPerformance: teamRows.map((r) => ({
          userId: r.user_id,
          userName: r.user_name,
          newCount: r.new_count || 0,
          mqlCount: r.mql_count || 0,
          sqlCount: r.sql_count || 0,
          quotedCount: r.quoted_count || 0,
          wonCount: r.won_count || 0,
        })),
        alerts,
        performanceMetrics,
        overdueTasks: overdueTaskRows,
      };
    },

    alertSettings: (_, __, { user }) => {
      requireRole(user, ['OWNER']);
      return toCamelArray(db.prepare('SELECT * FROM alert_settings ORDER BY setting_key').all());
    },

    qualificationCriteria: (_, { type }, { user }) => {
      requireAuth(user);
      if (type) {
        return toCamelArray(
          db.prepare('SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ? ORDER BY created_at').all(type)
        );
      }
      return toCamelArray(
        db.prepare('SELECT * FROM qualification_criteria WHERE is_active = 1 ORDER BY created_at').all()
      );
    },

    calendarAuthUrl: (_, __, { user }) => {
      requireAuth(user);
      const url = calendarService.getAuthUrl(user.id);
      return { url };
    },

    calendarEvents: (_, { limit = 10 }, { user }) => {
      requireAuth(user);
      const rows = db.prepare(
        'SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_time ASC LIMIT ?'
      ).all(user.id, limit);
      return rows.map((r) => ({
        ...toCamel(r),
        attendees: r.attendees ? JSON.parse(r.attendees) : [],
      }));
    },

    isCalendarConnected: (_, __, { user }) => {
      requireAuth(user);
      return calendarService.isCalendarConnected(user.id);
    },

    freeBusy: async (_, { timeMin, timeMax }, { user }) => {
      requireAuth(user);
      return calendarService.getFreeBusy(user.id, { timeMin, timeMax });
    },
  },

  // ── Mutations ──
  Mutation: {
    googleLogin: async (_, { idToken }) => {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = (payload.email || '').trim().toLowerCase();
        const name = (payload.name || '').trim() || email.split('@')[0] || 'Owner';
        const avatarUrl = payload.picture;
        const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
        const isConfiguredOwner = !!ownerEmail && email === ownerEmail;

        let dbUser = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);

        // Bootstrap OWNER account from env if it does not exist yet.
        if (!dbUser && isConfiguredOwner) {
          const id = uuidv4();
          db.prepare(
            `INSERT INTO users (id, email, name, avatar_url, role, reports_to, is_active)
             VALUES (?, ?, ?, ?, 'OWNER', NULL, 1)`
          ).run(id, email, name, avatarUrl || null);
          dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }

        if (!dbUser) {
          throw new Error('User not registered. Contact your administrator.');
        }

        // Keep configured OWNER account privileged and active.
        if (isConfiguredOwner && (dbUser.role !== 'OWNER' || !dbUser.is_active)) {
          db.prepare(
            `UPDATE users
             SET role = 'OWNER', is_active = 1, reports_to = NULL, updated_at = datetime('now')
             WHERE id = ?`
          ).run(dbUser.id);
          dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(dbUser.id);
        }

        if (!dbUser.is_active) {
          throw new Error('Account is deactivated. Contact your administrator.');
        }

        if (avatarUrl) {
          db.prepare("UPDATE users SET avatar_url = ?, name = ?, updated_at = datetime('now') WHERE id = ?").run(avatarUrl, name, dbUser.id);
          dbUser.avatar_url = avatarUrl;
          dbUser.name = name;
        } else {
          db.prepare("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, dbUser.id);
          dbUser.name = name;
        }

        const token = generateToken(dbUser);
        return { token, user: toCamel(dbUser) };
      } catch (err) {
        throw new Error(`Google login failed: ${err.message}`);
      }
    },

    devLogin: (_, { email }) => {
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_LOGIN !== 'true') {
        throw new Error('Dev login not available in production');
      }
      const dbUser = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
      if (!dbUser) throw new Error('User not found');

      const token = generateToken(dbUser);
      return { token, user: toCamel(dbUser) };
    },

    createUser: (_, { email, name, role, reportsTo }, { user }) => {
      requireRole(user, ['OWNER']);
      const id = uuidv4();
      db.prepare(
        'INSERT INTO users (id, email, name, role, reports_to) VALUES (?, ?, ?, ?, ?)'
      ).run(id, email, name, role, reportsTo || null);
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    updateUser: (_, { id, input }, { user }) => {
      requireRole(user, ['OWNER']);
      const sets = [];
      const params = [];

      if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
      if (input.role !== undefined) { sets.push('role = ?'); params.push(input.role); }
      if (input.reportsTo !== undefined) { sets.push('reports_to = ?'); params.push(input.reportsTo); }
      if (input.isActive !== undefined) { sets.push('is_active = ?'); params.push(input.isActive ? 1 : 0); }

      sets.push("updated_at = datetime('now')");
      params.push(id);

      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    updateOrgStructure: (_, { userId, reportsTo, role }, { user }) => {
      requireRole(user, ['OWNER']);
      const sets = ["updated_at = datetime('now')"];
      const params = [];

      if (reportsTo !== undefined) { sets.push('reports_to = ?'); params.push(reportsTo); }
      if (role) { sets.push('role = ?'); params.push(role); }

      params.push(userId);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    },

    createLead: (_, { input: rawInput }, { user }) => {
      requireAuth(user);
      const input = validateLeadInput(rawInput);
      const {
        designation, firstName, middleName, lastName,
        company, email: leadEmail, phone, status = 'NEW', priority = 'P3',
        source, assignedTo, budget, location, deliveryDays, notes,
        campaignName, campaignActive,
        propertyInPossession, expectedHandoverMonth, expectedHandoverYear,
        currentLivingArea, currentLivingCity, currentLivingCountry,
        contacts
      } = input;

      const assignTo = assignedTo || user.id;
      const id = uuidv4();
      const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      db.prepare(
        `INSERT INTO leads (id, name, designation, first_name, middle_name, last_name, company, email, phone, status, priority, source, assigned_to, budget, location, delivery_days, notes, created_by,
         campaign_name, campaign_active, property_in_possession, expected_handover_month, expected_handover_year,
         current_living_area, current_living_city, current_living_country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, displayName, designation || null, firstName, middleName || null, lastName || null,
        company, leadEmail, phone, status, priority, source, assignTo, budget, location, deliveryDays, notes, user.id,
        campaignName || null, campaignActive !== undefined && campaignActive !== null ? (campaignActive ? 1 : 0) : null,
        propertyInPossession !== undefined && propertyInPossession !== null ? (propertyInPossession ? 1 : 0) : null,
        expectedHandoverMonth || null, expectedHandoverYear || null,
        currentLivingArea || null, currentLivingCity || null, currentLivingCountry || null);

      // Insert contacts
      if (contacts && contacts.length > 0) {
        const insertContact = db.prepare(
          'INSERT INTO lead_contacts (id, lead_id, contact_order, name, phone, email, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const c of contacts) {
          insertContact.run(uuidv4(), id, c.contactOrder, c.name || null, c.phone || null, c.email || null, c.relationship || null);
        }
      }

      // Log activity
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content) VALUES (?, ?, ?, 'NOTE', 'Lead created')`
      ).run(uuidv4(), id, user.id);

      // Auto-qualify based on MQL/SQL criteria
      applyQualification(id, user.id);

      return toCamel(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
    },

    updateLead: (_, { id, input: rawInput }, { user }) => {
      requireAuth(user);
      const input = validateLeadInput(rawInput);

      const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!existing) throw new Error('Lead not found');
      if (user.role === 'SALES_EXECUTIVE' && existing.assigned_to !== user.id) {
        throw new Error('Access denied');
      }

      const sets = [];
      const params = [];

      const simpleFields = {
        designation: 'designation',
        firstName: 'first_name',
        middleName: 'middle_name',
        lastName: 'last_name',
        company: 'company',
        email: 'email',
        phone: 'phone',
        status: 'status',
        priority: 'priority',
        source: 'source',
        budget: 'budget',
        location: 'location',
        notes: 'notes',
        assignedTo: 'assigned_to',
        deliveryDays: 'delivery_days',
        campaignName: 'campaign_name',
        expectedHandoverMonth: 'expected_handover_month',
        expectedHandoverYear: 'expected_handover_year',
        currentLivingArea: 'current_living_area',
        currentLivingCity: 'current_living_city',
        currentLivingCountry: 'current_living_country',
      };

      for (const [jsField, dbField] of Object.entries(simpleFields)) {
        if (input[jsField] !== undefined) {
          sets.push(`${dbField} = ?`);
          params.push(input[jsField]);
        }
      }

      // Boolean fields
      if (input.campaignActive !== undefined) {
        sets.push('campaign_active = ?');
        params.push(input.campaignActive !== null ? (input.campaignActive ? 1 : 0) : null);
      }
      if (input.propertyInPossession !== undefined) {
        sets.push('property_in_possession = ?');
        params.push(input.propertyInPossession !== null ? (input.propertyInPossession ? 1 : 0) : null);
      }

      // Update display name if name parts changed
      if (input.firstName !== undefined || input.middleName !== undefined || input.lastName !== undefined) {
        const fn = input.firstName !== undefined ? input.firstName : existing.first_name;
        const mn = input.middleName !== undefined ? input.middleName : existing.middle_name;
        const ln = input.lastName !== undefined ? input.lastName : existing.last_name;
        sets.push('name = ?');
        params.push([fn, mn, ln].filter(Boolean).join(' '));
      }

      sets.push("updated_at = datetime('now')");
      params.push(id);

      db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      // Upsert contacts
      if (input.contacts !== undefined) {
        db.prepare('DELETE FROM lead_contacts WHERE lead_id = ?').run(id);
        if (input.contacts && input.contacts.length > 0) {
          const insertContact = db.prepare(
            'INSERT INTO lead_contacts (id, lead_id, contact_order, name, phone, email, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          for (const c of input.contacts) {
            insertContact.run(uuidv4(), id, c.contactOrder, c.name || null, c.phone || null, c.email || null, c.relationship || null);
          }
        }
      }

      // Log status change
      if (input.status && input.status !== existing.status) {
        db.prepare(
          `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
        ).run(uuidv4(), id, user.id,
          `Status changed from ${existing.status} to ${input.status}`,
          JSON.stringify({ from: existing.status, to: input.status }));
      }

      // Auto-qualify based on MQL/SQL criteria (only if status wasn't manually set)
      if (!input.status) {
        applyQualification(id, user.id);
      }

      return toCamel(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
    },

    deleteLead: (_, { id }, { user }) => {
      requireRole(user, ['OWNER', 'SENIOR_MANAGER']);
      db.prepare('DELETE FROM leads WHERE id = ?').run(id);
      return true;
    },

    bulkUpdateLeadStatus: (_, { leadIds, status }, { user }) => {
      requireRole(user, ['OWNER', 'SENIOR_MANAGER']);
      const placeholders = leadIds.map(() => '?').join(', ');
      db.prepare(
        `UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      ).run(status, ...leadIds);
      return toCamelArray(
        db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders})`).all(...leadIds)
      );
    },

    createActivity: (_, { input }, { user }) => {
      requireAuth(user);
      const { leadId, type, content, metadata, dueDate } = input;
      const id = uuidv4();

      db.prepare(
        'INSERT INTO activities (id, lead_id, user_id, type, content, metadata, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, leadId, user.id, type, content, JSON.stringify(metadata || {}), dueDate || null);

      db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);

      return toCamel(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
    },

    completeTask: (_, { activityId }, { user }) => {
      requireAuth(user);
      const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND type = ?').get(activityId, 'TASK');
      if (!activity) throw new Error('Task not found');
      db.prepare("UPDATE activities SET is_completed = 1 WHERE id = ?").run(activityId);
      return toCamel(db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId));
    },

    createQuotation: (_, { input }, { user }) => {
      requireAuth(user);
      const { leadId, amount, fileUrl, status = 'DRAFT' } = input;

      const versionRow = db.prepare(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM quotations WHERE lead_id = ?'
      ).get(leadId);
      const version = versionRow.next_version;

      const id = uuidv4();
      db.prepare(
        'INSERT INTO quotations (id, lead_id, version, amount, file_url, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, leadId, version, amount, fileUrl, status, user.id);

      // Log activity
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'QUOTATION', ?, ?)`
      ).run(uuidv4(), leadId, user.id, `Quotation v${version} created`, JSON.stringify({ version, amount, status }));

      db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);

      return toCamel(db.prepare('SELECT * FROM quotations WHERE id = ?').get(id));
    },

    updateQuotation: (_, { id, input }, { user }) => {
      requireAuth(user);
      const sets = [];
      const params = [];

      if (input.amount !== undefined) { sets.push('amount = ?'); params.push(input.amount); }
      if (input.fileUrl !== undefined) { sets.push('file_url = ?'); params.push(input.fileUrl); }
      if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
      sets.push("updated_at = datetime('now')");
      params.push(id);

      db.prepare(`UPDATE quotations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return toCamel(db.prepare('SELECT * FROM quotations WHERE id = ?').get(id));
    },

    updateAlertSettings: (_, { settings }, { user }) => {
      requireRole(user, ['OWNER']);
      const results = [];

      const upsert = db.prepare(`
        INSERT INTO alert_settings (id, setting_key, setting_value, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = datetime('now')
      `);

      for (const s of settings) {
        upsert.run(uuidv4(), s.settingKey, s.settingValue, user.id);
        results.push(toCamel(db.prepare('SELECT * FROM alert_settings WHERE setting_key = ?').get(s.settingKey)));
      }

      return results;
    },

    saveQualificationCriteria: (_, { criteria, type }, { user }) => {
      requireRole(user, ['OWNER']);

      // Deactivate all existing criteria for this type
      db.prepare('UPDATE qualification_criteria SET is_active = 0 WHERE type = ?').run(type);

      const results = [];
      if (criteria && criteria.length > 0) {
        const insert = db.prepare(
          'INSERT INTO qualification_criteria (id, type, field, operator, value, created_by) VALUES (?, ?, ?, ?, ?, ?)'
        );

        for (const c of criteria) {
          const id = uuidv4();
          insert.run(id, type, c.field, c.operator, c.value, user.id);
          results.push(toCamel(db.prepare('SELECT * FROM qualification_criteria WHERE id = ?').get(id)));
        }
      }

      // Re-evaluate all eligible leads against updated criteria
      reEvaluateAllLeads(user.id);

      return results;
    },

    createCalendarEvent: async (_, { input }, { user }) => {
      requireAuth(user);
      const { leadId, title, description, startTime, endTime, attendees = [], addMeetLink = false } = input;

      if (new Date(startTime) >= new Date(endTime)) {
        throw new Error('End time must be after start time.');
      }

      let googleEvent = null;
      try {
        googleEvent = await calendarService.createCalendarEvent(user.id, {
          title,
          description,
          startTime,
          endTime,
          attendees,
          addMeetLink,
        });
      } catch (err) {
        console.warn('Google Calendar API call failed, saving locally only:', err.message);
      }

      const id = uuidv4();
      db.prepare(
        `INSERT INTO calendar_events (id, lead_id, user_id, google_event_id, title, description, start_time, end_time, meet_link, html_link, attendees)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, leadId || null, user.id,
        googleEvent?.eventId || null,
        title, description || null,
        startTime, endTime,
        googleEvent?.meetLink || null,
        googleEvent?.htmlLink || null,
        JSON.stringify(attendees)
      );

      // Log activity if linked to a lead
      if (leadId) {
        const meetInfo = googleEvent?.meetLink ? ` | Meet: ${googleEvent.meetLink}` : '';
        db.prepare(
          `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'MEETING', ?, ?)`
        ).run(
          uuidv4(), leadId, user.id,
          `Meeting scheduled: ${title}${meetInfo}`,
          JSON.stringify({ eventId: id, startTime, endTime, meetLink: googleEvent?.meetLink })
        );
        db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
      }

      const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
      return {
        ...toCamel(row),
        attendees: row.attendees ? JSON.parse(row.attendees) : [],
      };
    },

    deleteCalendarEvent: async (_, { eventId }, { user }) => {
      requireAuth(user);
      const event = db.prepare('SELECT * FROM calendar_events WHERE id = ? AND user_id = ?').get(eventId, user.id);
      if (!event) throw new Error('Event not found');

      if (event.google_event_id) {
        try {
          await calendarService.deleteCalendarEvent(user.id, event.google_event_id);
        } catch (err) {
          console.warn('Failed to delete from Google Calendar:', err.message);
        }
      }

      db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId);
      return true;
    },

    disconnectCalendar: (_, __, { user }) => {
      requireAuth(user);
      db.prepare(
        'UPDATE users SET google_access_token = NULL, google_refresh_token = NULL, google_token_expiry = NULL WHERE id = ?'
      ).run(user.id);
      return true;
    },

    syncCalendarEvents: async (_, __, { user }) => {
      requireAuth(user);
      return calendarService.syncEventsFromGoogle(user.id);
    },

    updateCalendarEvent: async (_, { eventId, input }, { user }) => {
      requireAuth(user);
      const event = db.prepare('SELECT * FROM calendar_events WHERE id = ? AND user_id = ?').get(eventId, user.id);
      if (!event) throw new Error('Event not found');

      const effectiveStart = input.startTime || event.start_time;
      const effectiveEnd = input.endTime || event.end_time;
      if (new Date(effectiveStart) >= new Date(effectiveEnd)) {
        throw new Error('End time must be after start time.');
      }

      if (event.google_event_id) {
        await calendarService.updateCalendarEvent(user.id, event.google_event_id, input);
      }

      const { title, description, startTime, endTime, attendees } = input;
      const updates = [];
      const params = [];
      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (startTime !== undefined) { updates.push('start_time = ?'); params.push(startTime); }
      if (endTime !== undefined) { updates.push('end_time = ?'); params.push(endTime); }
      if (attendees !== undefined) { updates.push('attendees = ?'); params.push(JSON.stringify(attendees)); }
      if (updates.length) {
        updates.push("updated_at = datetime('now')");
        params.push(eventId);
        db.prepare(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(eventId);
      return { ...toCamel(row), attendees: row.attendees ? JSON.parse(row.attendees) : [] };
    },

    uploadFile: (_, { input }, { user }) => {
      requireAuth(user);
      const { leadId, fileName, fileUrl, fileType, fileSize, category, subCategory } = input;
      const id = uuidv4();
      db.prepare(
        `INSERT INTO files (id, lead_id, filename, file_url, file_type, file_size, sub_category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, leadId, fileName, fileUrl, fileType || null, fileSize || null, subCategory || null, user.id);

      // Log activity
      db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'FILE_UPLOAD', ?, ?)`
      ).run(uuidv4(), leadId, user.id, `File uploaded: ${fileName}`, JSON.stringify({ fileId: id, subCategory: subCategory || 'GENERAL' }));

      db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);

      return toCamel(db.prepare('SELECT * FROM files WHERE id = ?').get(id));
    },

    deleteFile: (_, { id }, { user }) => {
      requireAuth(user);
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
      if (!file) throw new Error('File not found');
      db.prepare('DELETE FROM files WHERE id = ?').run(id);
      return true;
    },

    saveColumnPreferences: (_, { columns }, { user }) => {
      requireAuth(user);
      const json = JSON.stringify(columns);
      db.prepare("UPDATE users SET leads_column_preferences = ?, updated_at = datetime('now') WHERE id = ?").run(json, user.id);
      return toCamel(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));
    },
  },
};

module.exports = resolvers;
