import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
	host: process.env.DB_HOST || '127.0.0.1',
	port: Number(process.env.DB_PORT) || 3306,
	user: process.env.DB_USER || '', //DB名
	password: process.env.DB_PASSWORD || '', //パスワード
	database: process.env.DB_NAME || '', //ユーザー名
	waitForConnections: true,
	connectionLimit: 10,
	timezone: 'Z'
});

export default pool;
