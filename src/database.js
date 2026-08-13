const Database = require("better-sqlite3");

const db = new Database(process.env.DB_PATH || "tribunal.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS plaintes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plaignant TEXT NOT NULL,
    accuse TEXT NOT NULL,
    motif TEXT NOT NULL,
    description TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'En attente',
    juge TEXT,
    peine TEXT,
    raison TEXT,
    created_at TEXT NOT NULL,
    verdict_at TEXT
  )
`);

module.exports = db;
