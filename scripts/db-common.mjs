import nextEnv from '@next/env';
import mysql from 'mysql2/promise';
nextEnv.loadEnvConfig(process.cwd());
export const database = process.env.DB_NAME;
export function connect(db = database) {
  return mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:db,charset:'utf8mb4',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,multipleStatements:false});
}
