import {translateRequest} from './translate.js';
export default {async fetch(request,env) {
 const path=new URL(request.url).pathname;
 if(path==='/api/translate')return translateRequest(request,env);
 if(path==='/api/translation-status')return Response.json({configured:!!env.GEMINI_API_KEY},{headers:{'Cache-Control':'no-store'}});
 const key=Object.hasOwn(ASSETS,path)?path:'/index.html';
 const asset=ASSETS[key];if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':key.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
