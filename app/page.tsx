import {redirect} from 'next/navigation';
import {currentUser} from '../lib/auth';
import Home from './home-client';
export const dynamic='force-dynamic';
export default async function Page(){
 let user;try{user=await currentUser();}catch{redirect('/login?unavailable=1');}
 if(!user)redirect('/login');
 return <Home/>;
}
