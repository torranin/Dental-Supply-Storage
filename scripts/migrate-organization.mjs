import { readFile } from 'node:fs/promises';
import { connect } from './db-common.mjs';
import { backup } from './backup-db.mjs';
const c=await connect();
try {
 const [done]=await c.execute('SELECT version FROM schema_migrations WHERE version=?',['002_organization']);
 if(done.length) console.log('Organization schema already applied.');
 else {
  await backup('before-organization');
  const sql=await readFile('database/migrations/002_organization.sql','utf8');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await c.query(statement);
  await c.execute('INSERT INTO schema_migrations(version) VALUES (?)',['002_organization']);
  await backup('after-schema');
  console.log('Organization schema applied.');
 }
} catch(e){console.error(e.code||e.message);process.exitCode=1;}finally{await c.end();}
