import { readFile } from 'node:fs/promises';
import { connect } from './db-common.mjs';
import { backup } from './backup-db.mjs';
const c=await connect();
try {
 const [tables]=await c.query('SHOW TABLES');
 if(tables.length){
  const [exists]=await c.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations'");
  if(exists[0].total){const [done]=await c.query('SELECT version FROM schema_migrations WHERE version=?',['001_inventory']);if(done.length){console.log('Schema already applied.');process.exitCode=0;}else{throw new Error('Existing partial schema requires inspection.');}}
  else throw new Error('Existing tables require inspection before migration.');
 }else{
  await backup('before-schema');
  const sql=await readFile('database/migrations/001_inventory.sql','utf8');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await c.query(statement);
  await c.beginTransaction();
  for(const name of ['วัสดุสิ้นเปลือง','วัสดุบูรณะ','วัสดุพิมพ์ปาก','เครื่องมือทันตกรรม']) await c.execute('INSERT INTO categories(name) VALUES (?)',[name]);
  for(const name of ['กล่อง','หลอด','ถุง','ชิ้น','ห่อ']) await c.execute('INSERT INTO units(name) VALUES (?)',[name]);
  await c.execute('INSERT INTO schema_migrations(version) VALUES (?)',['001_inventory']);
  await c.commit();
  console.log('Created 7 tables; materials and movements remain empty.');
  await backup('after-schema');
 }
} catch(e){await c.rollback();console.error(e.code||e.message);process.exitCode=1;}finally{await c.end();}
