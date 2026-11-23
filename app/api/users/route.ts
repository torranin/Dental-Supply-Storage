import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import type {RowDataPacket} from 'mysql2';
import {currentUser,sameOrigin} from '../../../lib/auth';
import {getDb} from '../../../lib/db';
const derive=promisify(scrypt);
export const dynamic='force-dynamic';
export async function GET(){try{const actor=await currentUser();if(!actor)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});if(actor.role!=='admin')return NextResponse.json({error:'เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ได้'},{status:403});const [users]=await getDb().query('SELECT id,username,display_name name,role,is_active active,locked_until>UTC_TIMESTAMP() locked FROM users ORDER BY id');return NextResponse.json({users,currentUserId:actor.id});}catch{return NextResponse.json({error:'โหลดผู้ใช้งานไม่สำเร็จ'},{status:503});}}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:403});
 let c;
 try{
 const actor=await currentUser();if(!actor)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});if(actor.role!=='admin')return NextResponse.json({error:'ไม่มีสิทธิ์จัดการผู้ใช้'},{status:403});
 let b;try{b=await req.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 if(!b||!['create','update','resetPassword','unlock'].includes(b.action))return NextResponse.json({error:'คำสั่งไม่ถูกต้อง'},{status:400});
 let passwordHash='';
 if(b.action==='create'||b.action==='resetPassword'){
 if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)return NextResponse.json({error:'รหัสผ่านต้องมี 8–128 ตัวอักษร'},{status:400});
 const salt=randomBytes(16).toString('hex');passwordHash=salt+':'+(await derive(b.password,salt,64) as Buffer).toString('hex');
 }
 c=await getDb().getConnection();await c.beginTransaction();
 // Serialize account changes to preserve the active administrator invariant.
 const [users]=await c.query<RowDataPacket[]>('SELECT id,role,is_active FROM users ORDER BY id FOR UPDATE');
 const liveActor=users.find(u=>u.id===actor.id);if(!liveActor?.is_active||liveActor.role!=='admin'){await c.rollback();return NextResponse.json({error:'ไม่มีสิทธิ์จัดการผู้ใช้'},{status:403});}
 if(b.action==='create'||b.action==='update'){
 if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>120||!['admin','staff'].includes(b.role))throw Error('กรุณาระบุชื่อและสิทธิ์ให้ถูกต้อง');
 }
 if(b.action==='create'){
 if(typeof b.username!=='string'||!/^[a-zA-Z0-9._-]{3,60}$/.test(b.username))throw Error('ชื่อผู้ใช้ต้องมี 3–60 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง');
 await c.execute('INSERT INTO users(username,display_name,password_hash,role) VALUES (?,?,?,?)',[b.username,b.name.trim(),passwordHash,b.role]);
 }else{
 if(!Number.isSafeInteger(b.id)||b.id<=0)throw Error('ผู้ใช้ไม่ถูกต้อง');
 const target=users.find(u=>u.id===b.id);if(!target)throw Error('ไม่พบผู้ใช้');
 if(b.action==='update'){
 if(typeof b.active!=='boolean')throw Error('สถานะไม่ถูกต้อง');
 if(b.id===actor.id&&(!b.active||b.role!=='admin'))throw Error('ไม่สามารถปิดบัญชีหรือลดสิทธิ์ของตนเองได้');
 if(target.role==='admin'&&target.is_active&&(!b.active||b.role!=='admin')&&users.filter(u=>u.role==='admin'&&u.is_active).length<=1)throw Error('ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน');
 await c.execute('UPDATE users SET display_name=?,role=?,is_active=? WHERE id=?',[b.name.trim(),b.role,b.active,b.id]);
 if(!b.active||b.role!==target.role)await c.execute('DELETE FROM user_sessions WHERE user_id=?',[b.id]);
 }else if(b.action==='resetPassword'){
 await c.execute('UPDATE users SET password_hash=?,failed_attempts=0,locked_until=NULL WHERE id=?',[passwordHash,b.id]);
 await c.execute('DELETE FROM user_sessions WHERE user_id=?',[b.id]);
 }else await c.execute('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=?',[b.id]);
 }
 await c.commit();return NextResponse.json({ok:true,loginAgain:b.action==='resetPassword'&&b.id===actor.id});
 }catch(e){if(c)await c.rollback();const error=e as Error & {code?:string};return NextResponse.json({error:error.code==='ER_DUP_ENTRY'?'ชื่อผู้ใช้นี้มีอยู่แล้ว':error.code?'ไม่สามารถบันทึกผู้ใช้ได้':error.message},{status:error.code==='ER_DUP_ENTRY'?409:400});}finally{c?.release();}
}
