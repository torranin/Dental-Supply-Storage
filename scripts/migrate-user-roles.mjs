import {readFile} from 'node:fs/promises';
import {connect} from './db-common.mjs';
import {backup} from './backup-db.mjs';
const c=await connect();
try{const [done]=await c.execute('SELECT version FROM schema_migrations WHERE version=?',['005_user_roles']);if(!done.length){await backup('before-user-management');const sql=await readFile('database/migrations/005_user_roles.sql','utf8');for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await c.query(statement);await c.execute('INSERT INTO schema_migrations(version) VALUES (?)',['005_user_roles']);await backup('after-schema');}console.log('User roles ready.');}finally{await c.end();}
