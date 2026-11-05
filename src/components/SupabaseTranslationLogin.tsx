import {useState,useEffect} from 'react';
import {supabase,Session,signInWithGitHub} from '../utils/supabaseClient';
export function SupabaseTranslationLogin(){
 const [session,setSession]=useState<Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  void supabase.auth.getSession().then(({data,error})=>{
   if(!active)return;
   setSession(data.session);
   if(error)setMessage('লগইন সম্পন্ন হয়নি। GitHub দিয়ে আবার চেষ্টা করুন।');
  }).catch(()=>{if(active)setMessage('লগইন যাচাই করা যায়নি। আবার চেষ্টা করুন।');});
  const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);if(next)setMessage('লগইন হয়েছে। এখন Gemini অনুবাদ করুন।');});
  return ()=>{active=false;data.subscription.unsubscribe();};
 },[]);
 if(!supabase)return null;
 const login=async()=>{
  setBusy(true);setMessage('');
  try{await signInWithGitHub();}
  catch(error){setMessage(error instanceof Error?error.message:'লগইন হয়নি। আবার চেষ্টা করুন।');setBusy(false);}
 };
 return <div className="mt-3 border border-teal-200 bg-teal-50/40 p-3 rounded-lg">
  {session?<div className="flex flex-wrap justify-between gap-2 text-xs">
   <span>লগইন: {session.user.email}</span>
   <button className="underline" onClick={async()=>{const {error}=await supabase!.auth.signOut({scope:'local'});setMessage(error?'লগআউট হয়নি। আবার চেষ্টা করুন।':'');}}>লগআউট</button>
  </div>:<div>
   <p className="text-xs mb-2">Gemini অনুবাদ ব্যবহার করতে আপনার GitHub অ্যাকাউন্ট দিয়ে লগইন করুন।</p>
   <button type="button" disabled={busy} onClick={login} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">{busy?'GitHub-এ যাচ্ছি…':'GitHub দিয়ে লগইন'}</button>
   <p className="text-[11px] mt-2 text-slate-500">GitHub-এর পাতায় লগইন হবে, তারপর এখানে ফিরে আসবেন। এখানে Gmail বা পাসওয়ার্ড দিতে হবে না।</p>
  </div>}
  {message&&<p role="status" className="text-xs mt-2">{message}</p>}
 </div>;
}
