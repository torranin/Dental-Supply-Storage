import {readFile} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {connect} from './db-common.mjs';
import {backup} from './backup-db.mjs';
const c=await connect();
try{
 const [done]=await c.execute('SELECT version FROM schema_migrations WHERE version=?',['004_auth']);
 if(done.length){console.log('Authentication already installed. Existing credentials unchanged.');}
 else{
 await backup('before-auth');
 const sql=await readFile('database/migrations/004_auth.sql','utf8');
 for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await c.query(statement);
 const password=randomBytes(15).toString('base64url');const salt=randomBytes(16).toString('hex');
 const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
 await c.beginTransaction();
 await c.execute('INSERT INTO users(username,display_name,password_hash) VALUES (?,?,?)',['admin','ผู้ดูแลระบบ',hash]);
 await c.execute('INSERT INTO schema_migrations(version) VALUES (?)',['004_auth']);await c.commit();
 console.log('Initial username: admin');console.log('Initial password: '+password);
 await backup('after-auth');
 }
}finally{await c.end();}
