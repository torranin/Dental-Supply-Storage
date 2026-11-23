import assert from 'node:assert/strict';
import {randomBytes,scryptSync} from 'node:crypto';
import {connect} from './db-common.mjs';
const base='http://127.0.0.1:3000',suffix=randomBytes(6).toString('hex'),admin='testadmin_'+suffix,staff='teststaff_'+suffix,password=randomBytes(15).toString('hex'),salt=randomBytes(16).toString('hex');
const db=await connect();let adminId,staffId;
async function call(path,body,cookie){return fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function login(username,p=password){const r=await call('/api/auth/login',{username,password:p});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
try{
 const [r]=await db.execute('INSERT INTO users(username,display_name,password_hash,role) VALUES (?,?,?,?)',[admin,'Test admin',salt+':'+scryptSync(password,salt,64).toString('hex'),'admin']);adminId=r.insertId;
 const cookie=await login(admin);
 assert.equal((await call('/api/users')).status,401);
 const create={action:'create',username:staff,name:'Test staff',role:'staff',password};
 assert.equal((await call('/api/users',create,cookie)).status,200);
 const [[row]]=await db.execute('SELECT id FROM users WHERE username=?',[staff]);staffId=row.id;
 assert.equal((await call('/api/users',create,cookie)).status,409);
 let staffCookie=await login(staff);
 assert.equal((await call('/api/users',null,staffCookie)).status,403);
 assert.equal((await call('/api/users',{action:'update',id:staffId,name:'Escalate',role:'admin',active:true},staffCookie)).status,403);
 const list=await (await call('/api/users',null,cookie)).json();assert.ok(list.users.every(u=>!('password_hash'in u)));assert.equal(list.currentUserId,adminId);
 assert.equal((await call('/api/users',{action:'update',id:adminId,name:'Test admin',role:'staff',active:true},cookie)).status,400);
 assert.equal((await call('/api/users',{action:'update',id:adminId,name:'Test admin',role:'admin',active:false},cookie)).status,400);
 assert.equal((await call('/api/users',{action:'update',id:staffId,name:'Updated',role:'staff',active:false},cookie)).status,200);
 assert.equal((await call('/api/inventory',null,staffCookie)).status,401);
 assert.equal((await call('/api/auth/login',{username:staff,password})).status,401);
 assert.equal((await call('/api/users',{action:'update',id:staffId,name:'Updated',role:'staff',active:true},cookie)).status,200);
 staffCookie=await login(staff);
 const newPassword=randomBytes(15).toString('hex');
 assert.equal((await call('/api/users',{action:'resetPassword',id:staffId,password:newPassword},cookie)).status,200);
 assert.equal((await call('/api/inventory',null,staffCookie)).status,401);
 assert.equal((await call('/api/auth/login',{username:staff,password})).status,401);
 await login(staff,newPassword);
 await db.execute('UPDATE users SET locked_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) WHERE id=?',[staffId]);
 assert.equal((await call('/api/users',{action:'unlock',id:staffId},cookie)).status,200);await login(staff,newPassword);
 console.log('PASS: create, duplicate username, role authorization, self-protection, disable/re-enable, password reset, revoked sessions, unlock; no password hashes exposed.');
}finally{if(staffId)await db.execute('DELETE FROM users WHERE id=?',[staffId]);if(adminId)await db.execute('DELETE FROM users WHERE id=?',[adminId]);await db.end();}
