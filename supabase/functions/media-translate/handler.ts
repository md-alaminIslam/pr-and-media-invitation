import {translateRequest} from './translate.js';
const origins=new Set(['https://md-alaminislam.github.io']);
const allowedUsers=new Set(['44c26c0e-6d99-48d8-abad-b5287592feaf','c9d3a65b-95cf-4215-a3fb-d9b5c3733576']);
export async function handleRequest(req:Request,env:Record<string,string|undefined>,fetcher:typeof fetch=fetch):Promise<Response> {
 const origin=req.headers.get('origin');
 const cors:Record<string,string>={'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 if(origin&&origins.has(origin))cors['Access-Control-Allow-Origin']=origin;
 const reply=(data:unknown,status:number)=>Response.json(data,{status,headers:cors});
 if(origin&&!origins.has(origin))return reply({error:'এই ওয়েবসাইট থেকে অনুরোধ অনুমোদিত নয়।'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'শুধু অনুবাদের POST অনুরোধ গ্রহণ করা হয়।'},405);
 const token=req.headers.get('authorization');
 if(!token?.startsWith('Bearer '))return reply({error:'Gemini ব্যবহার করতে লগইন করুন।'},401);
 try {
  const auth=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers:{Authorization:token,apikey:env.SUPABASE_ANON_KEY || ''},signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply({error:'লগইনের মেয়াদ শেষ। আবার লগইন করুন।'},401);
  const user=await auth.json();if(!allowedUsers.has(user.id)||!user.email_confirmed_at)return reply({error:'এই অ্যাকাউন্টের Gemini ব্যবহারের অনুমতি নেই।'},403);
  if(!env.GEMINI_API_KEY)return reply({error:'Supabase-এ Gemini secret বসানো এখনও বাকি আছে।'},503);
  // The authenticated adapter handles cross-origin validation; the shared translator sees a same-origin request.
  const headers=new Headers(req.headers);headers.delete('origin');headers.delete('authorization');headers.delete('apikey');
  const body=await req.text();if(body.length>80000)return reply({error:'লেখার পরিমাণ বেশি।'},413);
  const internal=new Request(req.url,{method:'POST',headers,body});
  const translated=await translateRequest(internal,env,fetcher);
  const out=new Headers(translated.headers);for(const [key,value]of Object.entries(cors))out.set(key,value);
  return new Response(translated.body,{status:translated.status,headers:out});
 }catch{return reply({error:'অনুবাদ সার্ভারে সংযোগ হয়নি। আবার চেষ্টা করুন।'},502);}
}
