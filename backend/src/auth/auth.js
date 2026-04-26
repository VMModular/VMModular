const jwt = require('jsonwebtoken');
const db = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const IS_PROD = process.env.NODE_ENV === 'production';

// ── JWT Secret Validation ──
if (IS_PROD && (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters in production');
  process.exit(1);
}
if (!IS_PROD && JWT_SECRET === 'dev-secret') {
  console.warn('⚠️  Using default JWT_SECRET – set a strong secret in .env');
}

// ── Input Sanitization Helpers ──
function sanitizeString(str, maxLength = 500) {
  if (str == null) return str;
  if (typeof str !== 'string') throw new Error('Expected a string value');
  const trimmed = str.trim().slice(0, maxLength);
  // Strip HTML tags to prevent stored XSS
  return trimmed.replace(/<[^>]*>/g, '');
}

function validateEmail(email) {
  if (!email) return email;
  const sanitized = sanitizeString(email, 254);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) throw new Error('Invalid email format');
  return sanitized.toLowerCase();
}

function validatePhone(phone) {
  if (!phone) return phone;
  const sanitized = sanitizeString(phone, 20);
  const phoneRegex = /^[+]?[\d\s\-().]{7,20}$/;
  if (!phoneRegex.test(sanitized)) throw new Error('Invalid phone format');
  return sanitized;
}

function validateLeadInput(input) {
  const sanitized = { ...input };

  // String fields
  const stringFields = [
    'designation', 'firstName', 'middleName', 'lastName',
    'company', 'location', 'notes', 'source',
    'campaignName', 'currentLivingArea', 'currentLivingCity', 'currentLivingCountry',
  ];
  for (const field of stringFields) {
    if (sanitized[field] !== undefined) {
      sanitized[field] = sanitizeString(sanitized[field], field === 'notes' ? 5000 : 255);
    }
  }

  // Email & phone
  if (sanitized.email !== undefined) sanitized.email = validateEmail(sanitized.email);
  if (sanitized.phone !== undefined) sanitized.phone = validatePhone(sanitized.phone);

  // Contacts
  if (sanitized.contacts && Array.isArray(sanitized.contacts)) {
    sanitized.contacts = sanitized.contacts.map(c => ({
      ...c,
      name: c.name ? sanitizeString(c.name, 255) : c.name,
      phone: c.phone ? validatePhone(c.phone) : c.phone,
      email: c.email ? validateEmail(c.email) : c.email,
      relationship: c.relationship ? sanitizeString(c.relationship, 100) : c.relationship,
    }));
  }

  return sanitized;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getContextUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const row = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id);
  return row || null;
}

function requireAuth(user) {
  if (!user) throw new Error('Authentication required');
  return user;
}

function requireRole(user, roles) {
  requireAuth(user);
  if (!roles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${roles.join(', ')}`);
  }
  return user;
}

module.exports = { generateToken, verifyToken, getContextUser, requireAuth, requireRole, sanitizeString, validateEmail, validatePhone, validateLeadInput };
