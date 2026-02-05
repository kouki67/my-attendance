import express from 'express';
import db from '../config/db.js';

const router = express.Router();

const pad = (value) => String(value).padStart(2, '0');

const formatLocalDateTime = (date = new Date()) => {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const min = pad(date.getMinutes());
	const ss = pad(date.getSeconds());
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const formatWorkDate = (date = new Date()) => {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	return `${yyyy}-${mm}-${dd}`;
};

const parseLocalDateTime = (value) => {
	if (!value) return null;
	const [datePart, timePart] = value.split(' ');
	if (!datePart || !timePart) return null;
	const [yyyy, mm, dd] = datePart.split('-').map(Number);
	const [hh, min, ss] = timePart.split(':').map(Number);
	return new Date(yyyy, mm - 1, dd, hh, min, ss);
};

const diffSeconds = (start, end) => {
	if (!start || !end) return 0;
	return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
};

const sumBreakSeconds = (breakRows) => breakRows.reduce((sum, row) => {
	const start = parseLocalDateTime(row.break_start_at);
	const end = parseLocalDateTime(row.break_end_at);
	return sum + diffSeconds(start, end);
}, 0);

const overlaps = (startA, endA, startB, endB) => {
	return startA < endB && startB < endA;
};

const getSessionByDate = (workDate) => {
	return db.prepare('SELECT * FROM work_sessions WHERE work_date = ?').get(workDate);
};

const getOpenBreak = (sessionId) => {
	return db.prepare('SELECT * FROM breaks WHERE session_id = ? AND break_end_at IS NULL').get(sessionId);
};

router.get('/status', (req, res) => {
	const today = formatWorkDate();
	const session = getSessionByDate(today);

	if (!session) {
		return res.status(200).json({
			work_date: today,
			status: 'not_started',
			session_id: null,
		});
	}

	if (session.end_at) {
		return res.status(200).json({
			work_date: today,
			status: 'finished',
			session_id: session.id,
		});
	}

	const openBreak = getOpenBreak(session.id);
	if (openBreak) {
		return res.status(200).json({
			work_date: today,
			status: 'on_break',
			session_id: session.id,
		});
	}

	return res.status(200).json({
		work_date: today,
		status: 'working',
		session_id: session.id,
	});
});

router.post('/punch', (req, res) => {
	const { action } = req.body;
	const now = new Date();
	const timestamp = formatLocalDateTime(now);
	const workDate = formatWorkDate(now);

	if (!['work_start', 'work_end', 'break_start', 'break_end'].includes(action)) {
		return res.status(400).json({ message: '不正な操作です' });
	}

	const session = getSessionByDate(workDate);

	if (action === 'work_start') {
		if (session) {
			return res.status(400).json({ message: '既に業務開始済みです' });
		}

		const nowText = timestamp;
		const stmt = db.prepare(`
			INSERT INTO work_sessions (work_date, start_at, end_at, created_at, updated_at)
			VALUES (?, ?, NULL, ?, ?)
		`);
		const result = stmt.run(workDate, nowText, nowText, nowText);
		return res.status(200).json({ message: '業務開始を記録しました', session_id: result.lastInsertRowid });
	}

	if (!session) {
		return res.status(400).json({ message: '業務開始が記録されていません' });
	}

	if (session.end_at) {
		return res.status(400).json({ message: '既に業務終了済みです' });
	}

	if (action === 'work_end') {
		const openBreak = getOpenBreak(session.id);
		if (openBreak) {
			return res.status(400).json({ message: '休憩終了後に業務終了してください' });
		}

		const stmt = db.prepare('UPDATE work_sessions SET end_at = ?, updated_at = ? WHERE id = ?');
		stmt.run(timestamp, timestamp, session.id);
		return res.status(200).json({ message: '業務終了を記録しました' });
	}

	if (action === 'break_start') {
		const openBreak = getOpenBreak(session.id);
		if (openBreak) {
			return res.status(400).json({ message: '既に休憩中です' });
		}

		const stmt = db.prepare(`
			INSERT INTO breaks (session_id, break_start_at, break_end_at, created_at, updated_at)
			VALUES (?, ?, NULL, ?, ?)
		`);
		stmt.run(session.id, timestamp, timestamp, timestamp);
		return res.status(200).json({ message: '休憩開始を記録しました' });
	}

	if (action === 'break_end') {
		const openBreak = getOpenBreak(session.id);
		if (!openBreak) {
			return res.status(400).json({ message: '休憩開始が記録されていません' });
		}

		const stmt = db.prepare('UPDATE breaks SET break_end_at = ?, updated_at = ? WHERE id = ?');
		stmt.run(timestamp, timestamp, openBreak.id);
		return res.status(200).json({ message: '休憩終了を記録しました' });
	}

	return res.status(500).json({ message: '処理に失敗しました' });
});

router.get('/sessions', (req, res) => {
	const month = req.query.month;
	const baseDate = month ? `${month}-01` : formatWorkDate();
	const base = baseDate.split('-').map(Number);
	if (base.length < 3 || Number.isNaN(base[0]) || Number.isNaN(base[1])) {
		return res.status(400).json({ message: '月の指定が不正です' });
	}
	const year = base[0];
	const monthIndex = base[1] - 1;
	const startDate = new Date(year, monthIndex, 1);
	const endDate = new Date(year, monthIndex + 1, 0);

	const monthStart = formatWorkDate(startDate);
	const monthEnd = formatWorkDate(endDate);

	const sessions = db.prepare(`
		SELECT * FROM work_sessions
		WHERE work_date BETWEEN ? AND ?
		ORDER BY work_date ASC
	`).all(monthStart, monthEnd);

	const breakRows = db.prepare(`
		SELECT * FROM breaks
		WHERE session_id IN (${sessions.length ? sessions.map(() => '?').join(',') : 'NULL'})
	`).all(...sessions.map((row) => row.id));

	const breakMap = new Map();
	for (const row of breakRows) {
		if (!breakMap.has(row.session_id)) {
			breakMap.set(row.session_id, []);
		}
		breakMap.get(row.session_id).push(row);
	}

	const sessionMap = new Map(sessions.map((session) => [session.work_date, session]));

	const rows = [];
	for (let day = 1; day <= endDate.getDate(); day += 1) {
		const current = new Date(year, monthIndex, day);
		const workDate = formatWorkDate(current);
		const session = sessionMap.get(workDate) || null;
		const breaksForSession = session ? (breakMap.get(session.id) || []) : [];

		const startAt = session?.start_at || null;
		const endAt = session?.end_at || null;
		const workSeconds = diffSeconds(parseLocalDateTime(startAt), parseLocalDateTime(endAt));
		const breakSeconds = sumBreakSeconds(breaksForSession);
		const netSeconds = Math.max(0, workSeconds - breakSeconds);

		rows.push({
			work_date: workDate,
			session_id: session?.id || null,
			start_at: startAt,
			end_at: endAt,
			break_seconds: breakSeconds,
			work_seconds: workSeconds,
			net_seconds: netSeconds,
		});
	}

	return res.status(200).json({ month: `${year}-${pad(monthIndex + 1)}`, rows });
});

router.get('/sessions/:id/breaks', (req, res) => {
	const sessionId = Number(req.params.id);
	if (!sessionId) {
		return res.status(400).json({ message: 'セッションIDが不正です' });
	}
	const rows = db.prepare(`
		SELECT id, break_start_at, break_end_at
		FROM breaks
		WHERE session_id = ?
		ORDER BY break_start_at ASC
	`).all(sessionId);
	return res.status(200).json({ breaks: rows });
});

router.put('/sessions/:id', (req, res) => {
	const sessionId = Number(req.params.id);
	const { start_at: startAt, end_at: endAt } = req.body;

	if (!sessionId || !startAt || !endAt) {
		return res.status(400).json({ message: '開始・終了時刻を入力してください' });
	}

	const startDate = parseLocalDateTime(startAt);
	const endDate = parseLocalDateTime(endAt);

	if (!startDate || !endDate) {
		return res.status(400).json({ message: '日時の形式が不正です' });
	}

	if (startDate >= endDate) {
		return res.status(400).json({ message: '開始時刻は終了時刻より前である必要があります' });
	}

	const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(sessionId);
	if (!session) {
		return res.status(404).json({ message: '対象のデータが見つかりません' });
	}

	const breaks = db.prepare('SELECT * FROM breaks WHERE session_id = ?').all(sessionId);
	for (const row of breaks) {
		const breakStart = parseLocalDateTime(row.break_start_at);
		const breakEnd = parseLocalDateTime(row.break_end_at);
		if (!breakStart || !breakEnd) {
			return res.status(400).json({ message: '休憩の開始・終了が未設定です' });
		}
		if (breakStart < startDate || breakEnd > endDate) {
			return res.status(400).json({ message: '休憩は業務時間内に設定してください' });
		}
		if (breakStart >= breakEnd) {
			return res.status(400).json({ message: '休憩開始は休憩終了より前である必要があります' });
		}
	}

	const timestamp = formatLocalDateTime();
	db.prepare('UPDATE work_sessions SET start_at = ?, end_at = ?, updated_at = ? WHERE id = ?')
		.run(startAt, endAt, timestamp, sessionId);

	return res.status(200).json({ message: '業務時間を更新しました' });
});

router.post('/sessions/:id/breaks', (req, res) => {
	const sessionId = Number(req.params.id);
	const { break_start_at: breakStartAt, break_end_at: breakEndAt } = req.body;

	if (!sessionId || !breakStartAt || !breakEndAt) {
		return res.status(400).json({ message: '休憩の開始・終了を入力してください' });
	}

	const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(sessionId);
	if (!session) {
		return res.status(404).json({ message: '対象のデータが見つかりません' });
	}

	const sessionStart = parseLocalDateTime(session.start_at);
	const sessionEnd = parseLocalDateTime(session.end_at);
	if (!sessionStart || !sessionEnd) {
		return res.status(400).json({ message: '業務開始・終了を先に入力してください' });
	}

	const breakStart = parseLocalDateTime(breakStartAt);
	const breakEnd = parseLocalDateTime(breakEndAt);
	if (!breakStart || !breakEnd) {
		return res.status(400).json({ message: '日時の形式が不正です' });
	}
	if (breakStart >= breakEnd) {
		return res.status(400).json({ message: '休憩開始は休憩終了より前である必要があります' });
	}
	if (breakStart < sessionStart || breakEnd > sessionEnd) {
		return res.status(400).json({ message: '休憩は業務時間内に設定してください' });
	}

	const existing = db.prepare('SELECT * FROM breaks WHERE session_id = ?').all(sessionId);
	for (const row of existing) {
		const start = parseLocalDateTime(row.break_start_at);
		const end = parseLocalDateTime(row.break_end_at);
		if (start && end && overlaps(breakStart, breakEnd, start, end)) {
			return res.status(400).json({ message: '休憩時間が重複しています' });
		}
	}

	const timestamp = formatLocalDateTime();
	const result = db.prepare(`
		INSERT INTO breaks (session_id, break_start_at, break_end_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`).run(sessionId, breakStartAt, breakEndAt, timestamp, timestamp);

	return res.status(200).json({ message: '休憩を追加しました', id: result.lastInsertRowid });
});

router.put('/breaks/:id', (req, res) => {
	const breakId = Number(req.params.id);
	const { break_start_at: breakStartAt, break_end_at: breakEndAt } = req.body;

	if (!breakId || !breakStartAt || !breakEndAt) {
		return res.status(400).json({ message: '休憩の開始・終了を入力してください' });
	}

	const row = db.prepare('SELECT * FROM breaks WHERE id = ?').get(breakId);
	if (!row) {
		return res.status(404).json({ message: '対象の休憩が見つかりません' });
	}

	const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(row.session_id);
	if (!session) {
		return res.status(404).json({ message: '対象のデータが見つかりません' });
	}

	const sessionStart = parseLocalDateTime(session.start_at);
	const sessionEnd = parseLocalDateTime(session.end_at);
	if (!sessionStart || !sessionEnd) {
		return res.status(400).json({ message: '業務開始・終了を先に入力してください' });
	}

	const breakStart = parseLocalDateTime(breakStartAt);
	const breakEnd = parseLocalDateTime(breakEndAt);
	if (!breakStart || !breakEnd) {
		return res.status(400).json({ message: '日時の形式が不正です' });
	}
	if (breakStart >= breakEnd) {
		return res.status(400).json({ message: '休憩開始は休憩終了より前である必要があります' });
	}
	if (breakStart < sessionStart || breakEnd > sessionEnd) {
		return res.status(400).json({ message: '休憩は業務時間内に設定してください' });
	}

	const existing = db.prepare('SELECT * FROM breaks WHERE session_id = ? AND id != ?').all(row.session_id, breakId);
	for (const item of existing) {
		const start = parseLocalDateTime(item.break_start_at);
		const end = parseLocalDateTime(item.break_end_at);
		if (start && end && overlaps(breakStart, breakEnd, start, end)) {
			return res.status(400).json({ message: '休憩時間が重複しています' });
		}
	}

	const timestamp = formatLocalDateTime();
	db.prepare('UPDATE breaks SET break_start_at = ?, break_end_at = ?, updated_at = ? WHERE id = ?')
		.run(breakStartAt, breakEndAt, timestamp, breakId);

	return res.status(200).json({ message: '休憩を更新しました' });
});

router.delete('/breaks/:id', (req, res) => {
	const breakId = Number(req.params.id);
	if (!breakId) {
		return res.status(400).json({ message: '休憩IDが不正です' });
	}

	const row = db.prepare('SELECT * FROM breaks WHERE id = ?').get(breakId);
	if (!row) {
		return res.status(404).json({ message: '対象の休憩が見つかりません' });
	}

	db.prepare('DELETE FROM breaks WHERE id = ?').run(breakId);
	return res.status(200).json({ message: '休憩を削除しました' });
});

export default router;
