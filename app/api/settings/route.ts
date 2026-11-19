import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
 try {
  const db=getDb();
  const [districts]=await db.query('SELECT id,name,province FROM districts ORDER BY province,name');
  const [centers]=await db.query('SELECT id,district_id,name,code FROM health_centers ORDER BY name');
  const [settings]=await db.query<RowDataPacket[]>('SELECT district_id FROM app_settings WHERE id=1');
  return NextResponse.json({districts,centers,districtId:settings[0]?.district_id??null});
 } catch { return NextResponse.json({error:'ไม่สามารถโหลดข้อมูลหน่วยงานจากฐานข้อมูลได้'},{status:503}); }
}
export async function POST(request:NextRequest) {
 if(request.headers.get('origin')!==request.nextUrl.origin) return NextResponse.json({error:'ไม่อนุญาตคำขอจากภายนอก'},{status:403});
 let data;
 try {data=await request.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 if(!data||typeof data!=='object') return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
 const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null;
 const id=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
 try {
  const db=getDb();
  if(data.action==='addDistrict'){
   const name=text(data.name,100),province=text(data.province,100);
   if(!name||!province)return NextResponse.json({error:'กรุณาระบุชื่ออำเภอและจังหวัด ไม่เกิน 100 ตัวอักษร'},{status:400});
   await db.execute('INSERT INTO districts(name,province) VALUES (?,?)',[name,province]);
  }else if(data.action==='addCenter'){
   const name=text(data.name,150),code=data.code===''||data.code==null?null:text(data.code,20);
   if(!name||!id(data.districtId)||(data.code&&!code))return NextResponse.json({error:'กรุณาระบุชื่อ รพ.สต. และเลือกอำเภอให้ถูกต้อง'},{status:400});
   await db.execute('INSERT INTO health_centers(district_id,name,code) VALUES (?,?,?)',[data.districtId,name,code]);
  }else if(data.action==='selectDistrict'){
   if(!id(data.districtId))return NextResponse.json({error:'กรุณาเลือกอำเภอ'},{status:400});
   await db.execute('UPDATE app_settings SET district_id=? WHERE id=1',[data.districtId]);
  }else{return NextResponse.json({error:'คำสั่งไม่ถูกต้อง'},{status:400});}
  return NextResponse.json({ok:true});
 }catch(e){
  const code=(e as {code?:string}).code;
  if(code==='ER_DUP_ENTRY')return NextResponse.json({error:'ชื่อหรือรหัสนี้มีอยู่แล้ว'},{status:409});
  if(code==='ER_NO_REFERENCED_ROW_2')return NextResponse.json({error:'ไม่พบอำเภอที่เลือก กรุณาโหลดข้อมูลใหม่'},{status:400});
  return NextResponse.json({error:'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล'},{status:503});
 }
}
