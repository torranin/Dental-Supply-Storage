import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import mysql from 'mysql2';
import { connect, database } from './db-common.mjs';
export async function backup(label = 'manual') {
 const c = await connect();
 try {
  const [objects] = await c.query('SHOW FULL TABLES');
  const [triggers] = await c.query('SHOW TRIGGERS');
  const [routines] = await c.query('SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()');
  const [events] = await c.query('SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()');
  if(objects.some(o=>o.Table_type!=='BASE TABLE')||triggers.length||routines.length||events.length) throw new Error('Use mysqldump for databases with views, triggers, routines or events.');
  const [engines] = await c.query('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  if(engines.some(e=>e.ENGINE!=='InnoDB')) throw new Error('Consistent backup requires InnoDB tables.');
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const lines = [`-- Dental Supply Storage: ${database}`,`-- UTC: ${new Date().toISOString()}`, 'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;'];
  const tables=[];
  for(const object of objects){
   const name=Object.values(object)[0];
   const [ddl]=await c.query('SHOW CREATE TABLE '+mysql.escapeId(name));
   lines.push(ddl[0]['Create Table']+';');
   const [rows]=await c.query('SELECT * FROM '+mysql.escapeId(name));
   for(const row of rows){lines.push('INSERT INTO '+mysql.escapeId(name)+' ('+Object.keys(row).map(mysql.escapeId).join(', ')+') VALUES ('+Object.values(row).map(v=>mysql.escape(v)).join(', ')+');');}
   tables.push({name,rows:rows.length});
  }
  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  await c.commit();
  await mkdir('backups',{recursive:true});
  const path=`backups/${database}-${new Date().toISOString().replace(/[:.]/g,'-')}-${label.replace(/[^a-z0-9-]/gi,'')}.sql`;
  const sql=lines.join('\n\n')+'\n';
  await writeFile(path+'.tmp',sql,{flag:'wx'});
  await rename(path+'.tmp',path);
  await writeFile(path+'.json',JSON.stringify({database,createdAt:new Date().toISOString(),sha256:createHash('sha256').update(sql).digest('hex'),tables},null,2));
  console.log(`Backup saved: ${path}`);
  return {path,tables};
 } finally {await c.end();}
}
if(process.argv[1]?.endsWith('backup-db.mjs')) backup(process.argv[2]).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
