import { connect } from './db-common.mjs';
import { backup } from './backup-db.mjs';
await backup('before-demo-materials');
const c=await connect();
const samples=[
['DEMO-001','ถุงมือไนไตรล์ Size M','วัสดุสิ้นเปลือง','กล่อง',48,20,180,'2028-06-30','A-01'],
['DEMO-002','หน้ากากอนามัย 3 ชั้น','วัสดุสิ้นเปลือง','กล่อง',12,20,95,'2028-03-31','A-02'],
['DEMO-003','Composite Resin A2','วัสดุบูรณะ','หลอด',24,10,850,'2027-09-30','B-01'],
['DEMO-004','Alginate วัสดุพิมพ์ปาก','วัสดุพิมพ์ปาก','ถุง',8,10,320,'2027-02-28','B-03'],
['DEMO-005','เข็มฉีดยาชา 27G','วัสดุสิ้นเปลือง','กล่อง',36,15,240,'2028-01-31','A-03'],
['DEMO-006','Etching Gel 37%','วัสดุบูรณะ','หลอด',18,8,290,'2027-11-30','B-02'],
['DEMO-007','กระจกส่องปาก No. 5','เครื่องมือทันตกรรม','ชิ้น',60,20,120,null,'C-01'],
['DEMO-008','ผ้าก๊อซปลอดเชื้อ 2 x 2 นิ้ว','วัสดุสิ้นเปลือง','ห่อ',6,15,65,'2027-01-15','A-04']];
try{await c.beginTransaction();let added=0;
for(const [code,name,category,unit,stock,min,price,expiry,location] of samples){
 const [exists]=await c.execute('SELECT id FROM materials WHERE code=?',[code]);if(exists.length)continue;
 const [[cat]]=await c.execute('SELECT id FROM categories WHERE name=?',[category]);
 const [[u]]=await c.execute('SELECT id FROM units WHERE name=?',[unit]);
 await c.execute('INSERT INTO storage_locations(code) VALUES (?) ON DUPLICATE KEY UPDATE code=VALUES(code)',[location]);
 const [[l]]=await c.execute('SELECT id FROM storage_locations WHERE code=?',[location]);
 const [m]=await c.execute('INSERT INTO materials(code,name,category_id,unit_id,location_id,stock,minimum_stock,unit_price,expiry_date) VALUES (?,?,?,?,?,?,?,?,?)',[code,name,cat.id,u.id,l.id,stock,min,price,expiry]);
 const [d]=await c.execute('INSERT INTO inventory_documents(reference_no,movement_type,note) VALUES (?, ?, ?)',['SEED-'+code,'in','ข้อมูลสมมุติ: ยอดตั้งต้นสำหรับทดลองระบบ']);
 await c.execute('INSERT INTO inventory_movements(document_id,material_id,quantity,unit_price,balance_after) VALUES (?,?,?,?,?)',[d.insertId,m.insertId,stock,price,stock]);added++;
}await c.commit();console.log('Added demo materials:',added);
}catch(e){await c.rollback();throw e;}finally{await c.end();}
await backup('after-demo-materials');
