const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbPath = process.env.DATABASE_URL;

if (dbPath && dbPath.startsWith('file:')) {
  dbPath = dbPath.replace('file:', '');
  // Resolve relative paths from root if needed
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
  }
} else {
  dbPath = path.join(__dirname, '..', '..', 'data', 'vmcrm.db');
}

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
