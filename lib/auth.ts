import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getDb } from './db';
export const SESSION_COOKIE='dental_session';
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function sameOrigin(req:NextRequest){try{const origin=new URL(req.headers.get('origin')||'');return origin.host===req.headers.get('host')&&(origin.protocol==='http:'||origin.protocol==='https:');}catch{return false;}}
export async function currentUser(){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const [rows]=await getDb().execute<RowDataPacket[]>('SELECT u.id,u.username,u.display_name,u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.is_active=1',[tokenHash(token)]);
 return rows[0]?{id:Number(rows[0].id),username:String(rows[0].username),name:String(rows[0].display_name),role:rows[0].role as 'admin'|'staff'}:null;
}
export async function requireSession(){try{return await currentUser()?null:NextResponse.json({error:'กรุณาเข้าสู่ระบบก่อนใช้งาน'},{status:401});}catch{return NextResponse.json({error:'ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาลองใหม่'},{status:503});}}
