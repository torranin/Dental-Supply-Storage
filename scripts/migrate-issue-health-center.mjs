import {readFile} from 'node:fs/promises';
import {connect} from './db-common.mjs';
import {backup} from './backup-db.mjs';
const c=await connect();
try{
 const [done]=await c.execute('SELECT version FROM schema_migrations WHERE version=?',['003_issue_health_center']);
 if(done.length)console.log('Health center issue migration already applied.');
 else{
 await backup('before-issue-health-center');
 const sql=await readFile('database/migrations/003_issue_health_center.sql','utf8');
 for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await c.query(statement);
 await c.execute('INSERT INTO schema_migrations(version) VALUES (?)',['003_issue_health_center']);
 await backup('after-schema');
 console.log('Health center issue migration applied.');
 }
}finally{await c.end();}
