import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
export const dynamic='force-dynamic';
export async function GET(){
 try{
 const db=getDb();
 const [items]=await db.query(`SELECT m.code id,m.name,c.name category,u.name unit,m.stock,m.minimum_stock min,CAST(m.unit_price AS DOUBLE) price,COALESCE(DATE_FORMAT(m.expiry_date,'%Y-%m-%d'),'') expiry,COALESCE(l.code,'') location FROM materials m JOIN categories c ON c.id=m.category_id JOIN units u ON u.id=m.unit_id LEFT JOIN storage_locations l ON l.id=m.location_id WHERE m.is_active=1 ORDER BY m.code`);
 const [entries]=await db.query(`SELECT CAST(v.id AS CHAR) id,m.name,d.movement_type kind,v.quantity,DATE_FORMAT(d.created_at,'%Y-%m-%dT%H:%i:%s') date,COALESCE(d.note,'') note,d.health_center_id healthCenterId,COALESCE(d.health_center_name,h.name,'') healthCenterName,u.name unit FROM inventory_movements v JOIN materials m ON m.id=v.material_id JOIN inventory_documents d ON d.id=v.document_id JOIN units u ON u.id=m.unit_id LEFT JOIN health_centers h ON h.id=d.health_center_id ORDER BY v.id DESC`);
 return NextResponse.json({items,entries});
 }catch{return NextResponse.json({error:'โหลดข้อมูลคลังไม่สำเร็จ กรุณาตรวจสอบฐานข้อมูล'},{status:503});}
}
export async function POST(req:NextRequest){
 let sameOrigin=false;try{sameOrigin=new URL(req.headers.get('origin')||'').host===req.headers.get('host');}catch{} 
 if(!sameOrigin)return NextResponse.json({error:'ไม่อนุญาตคำขอจากภายนอก'},{status:403});
 let b;try{b=await req.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 if(!b||typeof b!=='object')return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
 const text=(x:unknown,n:number)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=n?x.trim():null;
 let c;
 try{
 c=await getDb().getConnection();await c.beginTransaction();
 if(b.action==='add'){
 const i=b.item;
 if(!i||!text(i.id,30)||!text(i.name,120)||!text(i.category,100)||!text(i.unit,50)||!Number.isInteger(i.min)||i.min<0||i.min>2147483647||!Number.isFinite(i.price)||i.price<0||i.price>9999999999.99||typeof i.location!=='string'||i.location.length>30||typeof i.expiry!=='string'||(i.expiry&&!/^\d{4}-\d{2}-\d{2}$/.test(i.expiry)))throw Error('กรุณากรอกข้อมูลวัสดุให้ถูกต้อง');
 const [cats]=await c.execute<RowDataPacket[]>('SELECT id FROM categories WHERE name=?',[i.category]);if(!cats.length)throw Error('ไม่พบหมวดหมู่วัสดุ');
 await c.execute('INSERT INTO units(name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[i.unit.trim()]);
 const [units]=await c.execute<RowDataPacket[]>('SELECT id FROM units WHERE name=?',[i.unit.trim()]);
 let location=null;
 if(i.location.trim()){await c.execute('INSERT INTO storage_locations(code) VALUES (?) ON DUPLICATE KEY UPDATE code=VALUES(code)',[i.location.trim()]);const [locations]=await c.execute<RowDataPacket[]>('SELECT id FROM storage_locations WHERE code=?',[i.location.trim()]);location=locations[0].id;}
 await c.execute('INSERT INTO materials(code,name,category_id,unit_id,location_id,minimum_stock,unit_price,expiry_date) VALUES (?,?,?,?,?,?,?,?)',[i.id.trim().toUpperCase(),i.name.trim(),cats[0].id,units[0].id,location,i.min,i.price,i.expiry||null]);
 }else if(b.action==='in'||b.action==='out'){
 if(!text(b.id,30)||!Number.isInteger(b.quantity)||b.quantity<=0||b.quantity>2147483647||typeof b.note!=='string'||b.note.length>500)throw Error('กรุณาระบุจำนวนเต็มมากกว่า 0 และหมายเหตุไม่เกิน 500 ตัวอักษร');
 let healthCenterId=null,healthCenterName=null;
 if(b.action==='out'){
 if(!Number.isSafeInteger(b.healthCenterId)||b.healthCenterId<=0)throw Error('กรุณาเลือก รพ.สต.ที่เบิกวัสดุ');
 const [centers]=await c.execute<RowDataPacket[]>('SELECT id,name FROM health_centers WHERE id=? FOR SHARE',[b.healthCenterId]);
 if(!centers.length)throw Error('ไม่พบ รพ.สต.ที่เลือก กรุณาโหลดรายชื่อใหม่');
 healthCenterId=centers[0].id;healthCenterName=centers[0].name;
 }
 const [rows]=await c.execute<RowDataPacket[]>("SELECT *, DATE_FORMAT(expiry_date,'%Y-%m-%d') expiry FROM materials WHERE code=? AND is_active=1 FOR UPDATE",[b.id]);
 if(!rows.length)throw Error('ไม่พบวัสดุที่เลือก');const m=rows[0];
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
 if(b.action==='out'&&m.expiry&&m.expiry<today)throw Error('ไม่สามารถเบิกวัสดุหมดอายุได้');
 const balance=m.stock+(b.action==='in'?b.quantity:-b.quantity);
 if(balance<0)throw Error('จำนวนเบิกเกินยอดคงเหลือ');if(balance>2147483647)throw Error('ยอดคงเหลือเกินขอบเขตที่รองรับ');
 await c.execute('UPDATE materials SET stock=? WHERE id=?',[balance,m.id]);
 const [doc]=await c.execute<ResultSetHeader>('INSERT INTO inventory_documents(reference_no,movement_type,note,health_center_id,health_center_name) VALUES (?,?,?,?,?)',[crypto.randomUUID(),b.action,b.note,healthCenterId,healthCenterName]);
 await c.execute('INSERT INTO inventory_movements(document_id,material_id,quantity,unit_price,balance_after) VALUES (?,?,?,?,?)',[doc.insertId,m.id,b.quantity,m.unit_price,balance]);
 }else throw Error('คำสั่งไม่ถูกต้อง');
 await c.commit();return NextResponse.json({ok:true});
 }catch(e){if(c)await c.rollback();const err=e as Error & {code?:string};return NextResponse.json({error:err.code==='ER_DUP_ENTRY'?'รหัสวัสดุนี้มีอยู่แล้ว':err.code?'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือฐานข้อมูล':err.message},{status:err.code==='ER_DUP_ENTRY'?409:400});}finally{c?.release();}
}
