import {redirect} from 'next/navigation';
import {currentUser} from '../../lib/auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function LoginPage(){
 let user=null;try{user=await currentUser();}catch{}
 if(user)redirect('/');
 return <LoginForm/>;
}
