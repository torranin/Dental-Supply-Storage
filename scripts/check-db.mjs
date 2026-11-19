import nextEnv from '@next/env';
import mysql from 'mysql2/promise';

nextEnv.loadEnvConfig(process.cwd());
let connection;
try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
  });
  const [rows] = await connection.query('SELECT DATABASE() AS database_name, 1 AS connection_ok');
  console.log('Database connection successful:', rows[0].database_name);
} catch (error) {
  console.error('Database connection failed:', error.code ?? 'UNKNOWN');
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
