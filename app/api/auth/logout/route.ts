import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getDb} from '../../../../lib/db';
import {SESSION_COOKIE,tokenHash,sameOrigin} from '../../../../lib/auth';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:403});
 try{const token=(await cookies()).get(SESSION_COOKIE)?.value;if(token)await getDb().execute('DELETE FROM user_sessions WHERE token_hash=?',[tokenHash(token)]);
 const response=NextResponse.json({ok:true});response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:req.nextUrl.protocol==='https:',path:'/',maxAge:0});return response;
 }catch{return NextResponse.json({error:'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'},{status:503});}
}
