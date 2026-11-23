import { NextRequest,NextResponse } from 'next/server';
import { randomBytes,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type {RowDataPacket} from 'mysql2';
import {getDb} from '../../../../lib/db';
import {SESSION_COOKIE,sameOrigin,tokenHash} from '../../../../lib/auth';
const derive=promisify(scrypt);
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:403});
 let b;try{b=await req.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 if(!b||typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>60||b.password.length>256)return NextResponse.json({error:'กรุณาระบุชื่อผู้ใช้และรหัสผ่านให้ถูกต้อง'},{status:400});
 let c;
 try{
 c=await getDb().getConnection();await c.beginTransaction();
 const [rows]=await c.execute<RowDataPacket[]>('SELECT *,locked_until>UTC_TIMESTAMP() locked FROM users WHERE username=? FOR UPDATE',[b.username.trim()]);
 const user=rows[0];
 const [salt,hex]=(user?.password_hash||'00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');
 const computed=await derive(b.password,salt,64) as Buffer;
 const expected=Buffer.from(hex,'hex');
 const valid=expected.length===computed.length&&timingSafeEqual(expected,computed);
 if(!user||!user.is_active||user.locked||!valid){
 if(user&&!user.locked)await c.execute('UPDATE users SET locked_until=IF(failed_attempts>=4,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),NULL),failed_attempts=IF(failed_attempts>=4,0,failed_attempts+1) WHERE id=?',[user.id]);
 await c.commit();return NextResponse.json({error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกพักชั่วคราว กรุณาลองใหม่ภายหลัง'},{status:401});
 }
 await c.execute('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=?',[user.id]);
 await c.execute('DELETE FROM user_sessions WHERE expires_at<=UTC_TIMESTAMP()');
 const token=randomBytes(32).toString('hex');
 await c.execute('INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[tokenHash(token),user.id]);
 await c.commit();const response=NextResponse.json({ok:true});response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:req.nextUrl.protocol==='https:',path:'/',maxAge:8*60*60});response.headers.set('Cache-Control','no-store');return response;
 }catch{if(c)await c.rollback();return NextResponse.json({error:'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล'},{status:503});}finally{c?.release();}
}
