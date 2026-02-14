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

	CREATE TABLE IF NOT EXISTS credit_cards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		payment_day INTEGER NOT NULL CHECK(payment_day BETWEEN 1 AND 31),
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS household_expenses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		expense_date TEXT NOT NULL,
		category TEXT NOT NULL,
		description TEXT,
		amount INTEGER NOT NULL CHECK(amount > 0),
		payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'credit_card')),
		credit_card_id INTEGER,
		scheduled_payment_date TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY(credit_card_id) REFERENCES credit_cards(id) ON DELETE RESTRICT
	);

	CREATE INDEX IF NOT EXISTS idx_household_expenses_date ON household_expenses(expense_date);
	CREATE INDEX IF NOT EXISTS idx_household_expenses_card ON household_expenses(credit_card_id);
	CREATE INDEX IF NOT EXISTS idx_household_expenses_payment_date ON household_expenses(scheduled_payment_date);
`);

export default db;
