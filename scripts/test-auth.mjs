import assert from 'node:assert/strict';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import {connect} from './db-common.mjs';
const origin='http://127.0.0.1:3000';const username='test_'+randomBytes(8).toString('hex');const password=randomBytes(20).toString('hex');const salt=randomBytes(16).toString('hex');const c=await connect();let userId;
async function request(path,body,cookie){return fetch(origin+path,{method:body?'POST':'GET',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
try{
 const [u]=await c.execute('INSERT INTO users(username,display_name,password_hash) VALUES (?,?,?)',[username,'Authentication test',salt+':'+scryptSync(password,salt,64).toString('hex')]);userId=u.insertId;
 assert.equal((await request('/')).status,307);
 for(const path of ['/api/inventory','/api/settings']){assert.equal((await request(path)).status,401);assert.equal((await request(path,{action:'out'})).status,401);}
 assert.equal((await request('/api/auth/login',{username,password:'wrong'})).status,401);
 const login=await request('/api/auth/login',{username,password});assert.equal(login.status,200);
 const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=lax/i);const cookie=header.split(';')[0];
 assert.equal((await request('/',null,cookie)).status,200);assert.equal((await request('/login',null,cookie)).status,307);
 for(const path of ['/api/inventory','/api/settings'])assert.equal((await request(path,null,cookie)).status,200);
 assert.equal((await request('/api/inventory',null,'dental_session='+'a'.repeat(64))).status,401);
 assert.equal((await request('/api/auth/logout',{},cookie)).status,200);assert.equal((await request('/api/inventory',null,cookie)).status,401);
 const second=await request('/api/auth/login',{username,password});const cookie2=second.headers.get('set-cookie').split(';')[0];
 await c.execute('UPDATE user_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?',[userId]);assert.equal((await request('/api/settings',null,cookie2)).status,401);
 for(let n=0;n<5;n++)assert.equal((await request('/api/auth/login',{username,password:'wrong'})).status,401);
 assert.equal((await request('/api/auth/login',{username,password})).status,401);
 console.log('PASS: login redirect, protected read/write APIs, correct/incorrect password, HttpOnly cookie, forged/expired/revoked sessions, logout, lockout.');
}finally{if(userId)await c.execute('DELETE FROM users WHERE id=?',[userId]);await c.end();}
