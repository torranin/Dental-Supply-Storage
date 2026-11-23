import {randomBytes,scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
import {connect} from './db-common.mjs';
let authCookie='',authUserId;
const origin='http://127.0.0.1:3000';const code='TEST-'+Date.now();
async function post(data){const r=await fetch(origin+'/api/inventory',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:authCookie},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
const c=await connect();let created=false;
try{
 const username='inventory_test_'+randomBytes(5).toString('hex');const password=randomBytes(20).toString('hex');const salt=randomBytes(16).toString('hex');
 const [user]=await c.execute('INSERT INTO users(username,display_name,password_hash) VALUES (?,?,?)',[username,'Inventory test',salt+':'+scryptSync(password,salt,64).toString('hex')]);authUserId=user.insertId;
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username,password})});assert.equal(login.status,200);authCookie=login.headers.get('set-cookie').split(';')[0];
 const [[center]]=await c.query('SELECT id,name FROM health_centers ORDER BY id LIMIT 1');assert.ok(center);const healthCenterId=Number(center.id);
 const item={id:code,name:'Temporary API test',category:'วัสดุสิ้นเปลือง',unit:'กล่อง',min:1,price:10,expiry:'2028-01-01',location:''};
 assert.equal((await post({action:'add',item})).status,200);created=true;
 assert.equal((await post({action:'add',item})).status,409);
 assert.equal((await post({action:'in',id:code,quantity:5,note:'test'})).status,200);
 assert.equal((await post({action:'out',id:code,quantity:1,note:'missing center'})).status,400);
 assert.equal((await post({action:'out',id:code,quantity:1,note:'unknown center',healthCenterId:4294967295})).status,400);
 const result=await Promise.all([1,2].map(()=>post({action:'out',id:code,quantity:4,note:'test',healthCenterId})));
 assert.deepEqual(result.map(r=>r.status).sort(),[200,400]);
 assert.equal((await post({action:'in',id:code,quantity:-1,note:'test'})).status,400);
 const data=await (await fetch(origin+'/api/inventory',{headers:{Cookie:authCookie}})).json();assert.equal(data.items.find(i=>i.id===code).stock,1);
 const history=data.entries.filter(e=>e.name===item.name);const issue=history.find(e=>e.kind==='out');assert.equal(issue.healthCenterId,healthCenterId);assert.equal(issue.healthCenterName,center.name);assert.equal(issue.quantity,4);assert.equal(history.find(e=>e.kind==='in').healthCenterId,null);
 const [[m]]=await c.execute('SELECT id FROM materials WHERE code=?',[code]);
 const [[sum]]=await c.execute('SELECT COUNT(*) total FROM inventory_movements WHERE material_id=?',[m.id]);assert.equal(Number(sum.total),2);
 console.log('PASS: create, duplicate protection, receipt, concurrent issue stock protection, invalid quantity, persisted balance, health center validation and linked issue history');
}finally{
 if(created){await c.beginTransaction();const [[m]]=await c.execute('SELECT id FROM materials WHERE code=?',[code]);const [docs]=await c.execute('SELECT document_id FROM inventory_movements WHERE material_id=?',[m.id]);await c.execute('DELETE FROM inventory_movements WHERE material_id=?',[m.id]);for(const d of docs)await c.execute('DELETE FROM inventory_documents WHERE id=?',[d.document_id]);await c.execute('DELETE FROM materials WHERE id=?',[m.id]);await c.commit();}
 if(authUserId)await c.execute('DELETE FROM users WHERE id=?',[authUserId]);
 await c.end();
}
