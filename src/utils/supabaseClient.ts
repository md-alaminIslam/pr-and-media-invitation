import {createClient,Session} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{storage:window.sessionStorage,storageKey:'savor-media-gemini-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
export type {Session};
export async function translateViaSupabase(fields:{id:string;text:string}[]):Promise<Response> {
 if(!supabase)throw new Error('Supabase সংযোগ সেট করা নেই।');
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw new Error('Gemini ব্যবহার করতে আগে লগইন করুন।');
 return fetch(url+'/functions/v1/media-translate',{method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+session.access_token},body:JSON.stringify({fields}),signal:AbortSignal.timeout(65000)});
}
