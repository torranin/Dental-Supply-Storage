import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { connect } from './db-common.mjs';
const files=(await readdir('backups')).filter(f=>f.endsWith('-after-schema.sql')).sort();
if(!files.length) throw new Error('No after-schema backup found');
const path='backups/'+files.at(-1);
const sql=await readFile(path,'utf8');
const manifest=JSON.parse(await readFile(path+'.json','utf8'));
if(createHash('sha256').update(sql).digest('hex')!==manifest.sha256) throw new Error('Backup checksum mismatch');
const temporary='dental_restore_test_'+randomBytes(8).toString('hex');
const admin=await connect();
let restored,created=false;
try {
 await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4',[temporary]);created=true;
 restored=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:temporary,multipleStatements:true});
 await restored.query(sql);
 for(const table of manifest.tables){
  const [[result]]=await restored.query('SELECT COUNT(*) AS total FROM ??',[table.name]);
  if(result.total!==table.rows) throw new Error('Restored row count differs: '+table.name);
  const [[original]]=await admin.query('SHOW CREATE TABLE ??',[table.name]);
  const [[copy]]=await restored.query('SHOW CREATE TABLE ??',[table.name]);
  if(original['Create Table'].replace(/AUTO_INCREMENT=\d+ /g,'')!==copy['Create Table'].replace(/AUTO_INCREMENT=\d+ /g,'')) throw new Error('Restored schema differs: '+table.name);
 }
 const [[category]]=await restored.query('SELECT id FROM categories LIMIT 1');
 const [[unit]]=await restored.query('SELECT id FROM units LIMIT 1');
 let prevented=false;
 try {await restored.execute('INSERT INTO materials(code,name,category_id,unit_id,stock) VALUES (?,?,?,?,?)',['TEST','Constraint test',category.id,unit.id,-1]);}
 catch(e){if(e.code==='ER_CHECK_CONSTRAINT_VIOLATED') prevented=true;else throw e;}
 if(!prevented) throw new Error('Negative-stock check failed');
 const report={backup:path,verifiedAt:new Date().toISOString(),sha256:manifest.sha256,tables:manifest.tables,restore:'passed',schemaComparison:'passed',negativeStockConstraint:'passed'};
 await writeFile(path+'.verified.json',JSON.stringify(report,null,2));
 console.log('Restore verified:', manifest.tables.length, 'table definitions and row counts match. Negative-stock constraint passed.');
} finally {
 if(restored) await restored.end();
 if(created) await admin.query('DROP DATABASE ??',[temporary]);
 await admin.end();
}
