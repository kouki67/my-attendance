import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// データの取得
router.get('/', async (req, res) => {
	// try {
	// 	const [rows] = await db.execute(
	// 		`SELECT カラム名 FROM テーブル名` //カラム名、テーブル名を入れる
	// 	);

	// 	return res.status(200).json(rows);
	// } catch (error) {
	// 	console.error('Failed to fetch テーブル名 records:', error); //テーブル名を入れる
	// 	return res.status(500).json({ message: 'データの取得に失敗しました' });
	// }
});

export default router;
