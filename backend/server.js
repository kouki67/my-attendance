import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

import templateRoutes from './routes/template.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8800;

// セキュリティ対策
app.use(helmet());

// CORS設定
app.use(cors({
	origin: 'http://localhost:5100', // フロントエンドのURL
	credentials: true, // クッキーを含むリクエストを許可
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization']
}));

// ミドルウェア
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 在庫管理
app.use('/template', templateRoutes); 

// ルーター
// 管理者用
// app.use('/admin/auth', auth);
// app.use('/admin/employees', authMiddleware, employees);
// app.use('/admin/attendance', authMiddleware, attendance);

// 勤怠管理用
// app.use('/attendance/auth', attendanceAuth);
// app.use('/attendance/employees', attendanceAuthMiddleware, attendanceEmployees);
// app.use('/attendance', attendanceAuthMiddleware, attendanceAttendance);

// サーバー起動
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
