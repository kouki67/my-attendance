import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'attendance.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
	CREATE TABLE IF NOT EXISTS work_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		work_date TEXT NOT NULL UNIQUE,
		start_at TEXT,
		end_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS breaks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		break_start_at TEXT NOT NULL,
		break_end_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY(session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_breaks_session ON breaks(session_id);
`);

export default db;
