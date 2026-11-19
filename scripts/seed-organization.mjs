import { connect } from './db-common.mjs';
const c=await connect();
try{
 await c.beginTransaction();
 await c.execute('INSERT INTO districts(name,province) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',['แม่วาง','เชียงใหม่']);
 const [[district]]=await c.execute('SELECT id FROM districts WHERE name=? AND province=?',['แม่วาง','เชียงใหม่']);
 for(const name of ['รพ.สต.ดอนเปา','รพ.สต.วังผาปูน','รพ.สต.หนองเต่า','รพ.สต.นาทราย']) await c.execute('INSERT INTO health_centers(district_id,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[district.id,name]);
 await c.execute('UPDATE app_settings SET district_id=? WHERE id=1',[district.id]);
 await c.commit();console.log('Configured Mae Wang and 4 health centers.');
}catch(e){await c.rollback();throw e;}finally{await c.end();}
