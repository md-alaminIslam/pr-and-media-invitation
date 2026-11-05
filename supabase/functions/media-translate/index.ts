import {handleRequest} from './handler.ts';
Deno.serve(req=>handleRequest(req,{
 SUPABASE_URL:Deno.env.get('SUPABASE_URL'),SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY'),
 GEMINI_API_KEY:Deno.env.get('GEMINI_API_KEY'),GEMINI_MODEL:Deno.env.get('GEMINI_MODEL')
}));
