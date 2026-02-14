import express from 'express';
import db from '../config/db.js';

const router = express.Router();

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (date = new Date()) => {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	return `${yyyy}-${mm}-${dd}`;
};

const formatDateTime = (date = new Date()) => {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const mi = pad(date.getMinutes());
	const ss = pad(date.getSeconds());
	return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const parseDate = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
	const [yyyy, mm, dd] = value.split('-').map(Number);
	const date = new Date(yyyy, mm - 1, dd);
	if (Number.isNaN(date.getTime())) return null;
	if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
	return date;
};

const parseMonth = (value) => {
	if (!/^\d{4}-\d{2}$/.test(value || '')) return null;
	const [yyyy, mm] = value.split('-').map(Number);
	if (mm < 1 || mm > 12) return null;
	return new Date(yyyy, mm - 1, 1);
};

const dateWithDay = (year, monthIndex, day) => {
	const last = new Date(year, monthIndex + 1, 0).getDate();
	return new Date(year, monthIndex, Math.min(day, last));
};

const getScheduledPaymentDate = (expenseDate, paymentDay) => {
	const currentMonthPayment = dateWithDay(expenseDate.getFullYear(), expenseDate.getMonth(), paymentDay);
	if (expenseDate <= currentMonthPayment) {
		return formatDate(currentMonthPayment);
	}
	const nextMonthPayment = dateWithDay(expenseDate.getFullYear(), expenseDate.getMonth() + 1, paymentDay);
	return formatDate(nextMonthPayment);
};

const getMonthRange = (monthQuery) => {
	const monthDate = parseMonth(monthQuery) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
	const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
	return { start: formatDate(start), end: formatDate(end), month: `${start.getFullYear()}-${pad(start.getMonth() + 1)}` };
};

router.get('/cards', (req, res) => {
	const cards = db.prepare('SELECT * FROM credit_cards ORDER BY name ASC').all();
	return res.status(200).json({ cards });
});

router.post('/cards', (req, res) => {
	const { name, payment_day: paymentDayInput } = req.body;
	const paymentDay = Number(paymentDayInput);

	if (!name || !String(name).trim()) {
		return res.status(400).json({ message: 'カード名を入力してください' });
	}
	if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
		return res.status(400).json({ message: '支払日は1〜31で入力してください' });
	}

	const timestamp = formatDateTime();
	try {
		const result = db.prepare(`
			INSERT INTO credit_cards (name, payment_day, created_at, updated_at)
			VALUES (?, ?, ?, ?)
		`).run(String(name).trim(), paymentDay, timestamp, timestamp);
		const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(result.lastInsertRowid);
		return res.status(201).json({ message: 'カードを追加しました', card });
	} catch (error) {
		if (String(error.message).includes('UNIQUE')) {
			return res.status(409).json({ message: '同じカード名が既に登録されています' });
		}
		return res.status(500).json({ message: 'カードの追加に失敗しました' });
	}
});

router.put('/cards/:id', (req, res) => {
	const cardId = Number(req.params.id);
	const { name, payment_day: paymentDayInput } = req.body;
	const paymentDay = Number(paymentDayInput);
	if (!Number.isInteger(cardId)) {
		return res.status(400).json({ message: 'カードIDが不正です' });
	}
	if (!name || !String(name).trim()) {
		return res.status(400).json({ message: 'カード名を入力してください' });
	}
	if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
		return res.status(400).json({ message: '支払日は1〜31で入力してください' });
	}

	const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(cardId);
	if (!existing) {
		return res.status(404).json({ message: 'カードが見つかりません' });
	}

	const timestamp = formatDateTime();
	try {
		db.prepare(`
			UPDATE credit_cards
			SET name = ?, payment_day = ?, updated_at = ?
			WHERE id = ?
		`).run(String(name).trim(), paymentDay, timestamp, cardId);

		const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(cardId);
		return res.status(200).json({ message: 'カード設定を更新しました', card });
	} catch (error) {
		if (String(error.message).includes('UNIQUE')) {
			return res.status(409).json({ message: '同じカード名が既に登録されています' });
		}
		return res.status(500).json({ message: 'カード設定の更新に失敗しました' });
	}
});

router.delete('/cards/:id', (req, res) => {
	const cardId = Number(req.params.id);
	if (!Number.isInteger(cardId)) {
		return res.status(400).json({ message: 'カードIDが不正です' });
	}

	const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(cardId);
	if (!existing) {
		return res.status(404).json({ message: 'カードが見つかりません' });
	}

	const linked = db.prepare('SELECT COUNT(*) AS count FROM household_expenses WHERE credit_card_id = ?').get(cardId);
	if ((linked?.count || 0) > 0) {
		return res.status(400).json({ message: 'このカードの支出データがあるため削除できません' });
	}

	db.prepare('DELETE FROM credit_cards WHERE id = ?').run(cardId);
	return res.status(200).json({ message: 'カードを削除しました' });
});

router.get('/expenses', (req, res) => {
	const { start, end, month } = getMonthRange(req.query.month);
	const expenses = db.prepare(`
		SELECT
			e.*,
			c.name AS credit_card_name,
			c.payment_day AS credit_card_payment_day
		FROM household_expenses e
		LEFT JOIN credit_cards c ON c.id = e.credit_card_id
		WHERE e.expense_date BETWEEN ? AND ?
		ORDER BY e.expense_date DESC, e.id DESC
	`).all(start, end);

	const totals = expenses.reduce((acc, row) => {
		acc.total += row.amount;
		if (row.payment_method === 'credit_card') acc.credit += row.amount;
		if (row.payment_method === 'cash') acc.cash += row.amount;
		return acc;
	}, { total: 0, cash: 0, credit: 0 });

	return res.status(200).json({
		month,
		expenses,
		totals,
	});
});

router.post('/expenses', (req, res) => {
	const {
		expense_date: expenseDateInput,
		category,
		description,
		amount: amountInput,
		payment_method: paymentMethod,
		credit_card_id: creditCardIdInput,
	} = req.body;

	if (!expenseDateInput || !category || !paymentMethod) {
		return res.status(400).json({ message: '日付・カテゴリ・支払方法は必須です' });
	}

	const expenseDate = parseDate(expenseDateInput);
	if (!expenseDate) {
		return res.status(400).json({ message: '日付の形式が不正です' });
	}

	const amount = Number(amountInput);
	if (!Number.isInteger(amount) || amount <= 0) {
		return res.status(400).json({ message: '金額は1円以上の整数で入力してください' });
	}

	if (!['cash', 'credit_card'].includes(paymentMethod)) {
		return res.status(400).json({ message: '支払方法が不正です' });
	}

	let creditCardId = null;
	let scheduledPaymentDate = null;
	if (paymentMethod === 'credit_card') {
		creditCardId = Number(creditCardIdInput);
		if (!Number.isInteger(creditCardId)) {
			return res.status(400).json({ message: 'クレジットカードを選択してください' });
		}
		const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(creditCardId);
		if (!card) {
			return res.status(404).json({ message: 'クレジットカードが見つかりません' });
		}
		scheduledPaymentDate = getScheduledPaymentDate(expenseDate, card.payment_day);
	}

	const timestamp = formatDateTime();
	const result = db.prepare(`
		INSERT INTO household_expenses (
			expense_date,
			category,
			description,
			amount,
			payment_method,
			credit_card_id,
			scheduled_payment_date,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		formatDate(expenseDate),
		String(category).trim(),
		description ? String(description).trim() : '',
		amount,
		paymentMethod,
		creditCardId,
		scheduledPaymentDate,
		timestamp,
		timestamp,
	);

	const expense = db.prepare(`
		SELECT e.*, c.name AS credit_card_name
		FROM household_expenses e
		LEFT JOIN credit_cards c ON c.id = e.credit_card_id
		WHERE e.id = ?
	`).get(result.lastInsertRowid);

	return res.status(201).json({ message: '支出を登録しました', expense });
});

router.get('/payment-schedule', (req, res) => {
	const { start, end, month } = getMonthRange(req.query.month);
	const payments = db.prepare(`
		SELECT
			e.scheduled_payment_date,
			e.credit_card_id,
			c.name AS credit_card_name,
			COUNT(*) AS item_count,
			SUM(e.amount) AS total_amount
		FROM household_expenses e
		INNER JOIN credit_cards c ON c.id = e.credit_card_id
		WHERE e.payment_method = 'credit_card'
			AND e.scheduled_payment_date BETWEEN ? AND ?
		GROUP BY e.scheduled_payment_date, e.credit_card_id
		ORDER BY e.scheduled_payment_date ASC, c.name ASC
	`).all(start, end);

	return res.status(200).json({ month, payments });
});

export default router;
