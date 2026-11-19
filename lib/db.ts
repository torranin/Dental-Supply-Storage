import 'server-only';
import mysql, { type Pool } from 'mysql2/promise';

const globalForDb = globalThis as unknown as { dentalDb?: Pool };

export function getDb(): Pool {
  if (globalForDb.dentalDb) return globalForDb.dentalDb;
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing database configuration: ${key}`);
  }
  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid DB_PORT');
  }
  globalForDb.dentalDb = mysql.createPool({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 10000,
    enableKeepAlive: true,
    charset: 'utf8mb4',
  });
  return globalForDb.dentalDb;
}
