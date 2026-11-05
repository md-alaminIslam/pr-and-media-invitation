import test from 'node:test';import assert from 'node:assert/strict';import {translateRequest} from './translate.js';
const env={GEMINI_API_KEY:'test-server-only'};
const request=body=>new Request('https://private.example/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('valid translations use a server-only key, preserve ids and return no credentials',async()=>{
 const response=await translateRequest(request({fields:[{id:'chiefGuest.nameEn',text:'Mr. Kamal'}]}),env,async(url,opts)=>{assert.equal(opts.headers['x-goog-api-key'],env.GEMINI_API_KEY);assert.ok(!url.includes(env.GEMINI_API_KEY));return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({translations:[{id:'chiefGuest.nameEn',text:'জনাব কামাল'}]})}]}}]});});
 assert.equal(response.status,200);const body=await response.text();assert.ok(body.includes('জনাব কামাল'));assert.ok(!body.includes(env.GEMINI_API_KEY));
});
test('missing key, invalid inputs and cross-origin requests do not reach the provider',async()=>{
 let calls=0;const never=async()=>{calls++;throw new Error('unexpected');};
 assert.equal((await translateRequest(request({fields:[]}),{},never)).status,503);
 assert.equal((await translateRequest(request({fields:[]}),env,never)).status,400);
 assert.equal((await translateRequest(new Request('https://private.example/api/translate',{method:'POST',headers:{origin:'https://other.example'}}),env,never)).status,403);
 assert.equal(calls,0);
});
test('upstream errors do not expose provider details or silently use offline results',async()=>{
 const response=await translateRequest(request({fields:[{id:'eventTitleEn',text:'Medical Expo'}]}),env,async()=>new Response('sensitive provider response',{status:403}));assert.equal(response.status,502);const body=await response.text();assert.ok(!body.includes('sensitive provider'));assert.ok(body.includes('key'));
});
test('malformed, missing or duplicate returned ids reject the whole translation',async()=>{
 for(const translations of [[],[{id:'other',text:'বাংলা'}],[{id:'eventTitleEn',text:''}]]){
 const response=await translateRequest(request({fields:[{id:'eventTitleEn',text:'Expo'}]}),env,async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({translations})}]}}]}));assert.equal(response.status,502);
 }
});
test('unavailable default model discovers one supported Flash model and retries once',async()=>{
 let calls=0;const response=await translateRequest(request({fields:[{id:'eventTitleEn',text:'Expo'}]}),env,async(url)=>{calls++;if(calls===1)return new Response('',{status:404});if(url.endsWith('/models'))return Response.json({models:[{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}]});assert.ok(url.includes('gemini-3.5-flash'));return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({translations:[{id:'eventTitleEn',text:'প্রদর্শনী'}]})}]}}]});});assert.equal(response.status,200);assert.equal(calls,3);
});
