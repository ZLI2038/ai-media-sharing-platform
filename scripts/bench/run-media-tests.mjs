import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url));const workspace=path.resolve(here,'../..');
const app=path.join(workspace,'.bench/app');const root=path.join(app,'dist/server');
const req=createRequire(path.join(app,'package.json'));
const {Miniflare,Log,LogLevel}=createRequire(req.resolve('wrangler/package.json'))('miniflare');
async function walk(dir){const list=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())list.push(...await walk(p));else if(/\.(m?js)$/.test(e.name))list.push({type:'ESModule',path:p});}return list;}
const modules=(await walk(root)).sort((a,b)=>a.path===path.join(root,'index.js')?-1:b.path===path.join(root,'index.js')?1:a.path.localeCompare(b.path));
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{TOKEN_SECRET:'valid-media-isolated-test'},log:new Log(LogLevel.ERROR),outboundService:()=>{throw new Error('External requests are forbidden');}});
const output=path.join(workspace,'.bench/results');await fs.mkdir(output,{recursive:true});
const results={scope:'Additional production-built route checks with independently decoded PNG and MP4 fixtures, not live cloud tests.',checks:[]};
try{
  await mf.ready;
  const post=(url,body)=>mf.dispatchFetch('http://bench.local'+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post('/api/auth/signup',{username:'mediauser',password:'valid-media-fixture'})).status,201);
  const token=(await (await post('/api/auth/signin',{username:'mediauser',password:'valid-media-fixture'})).json()).token;
  const fixtures=JSON.parse(await fs.readFile(path.join(app,'../fixtures/manifest.json'),'utf8'));
  for(const f of fixtures){
    const bytes=await fs.readFile(f.path);const form=new FormData();form.set('message','decodable media fixture');form.set('media_file',new File([bytes],path.basename(f.path),{type:f.mime}));
    const request=new Request('http://bench.local/api/posts',{method:'POST',headers:{authorization:`Bearer ${token}`},body:form});
    const r=await mf.dispatchFetch(request.url,{method:'POST',headers:Object.fromEntries(request.headers),body:Buffer.from(await request.arrayBuffer())});
    const expected=f.size<=25*1024*1024?201:400;assert.equal(r.status,expected);
    let integrity=null;
    if(r.status!==201)await r.text();
    if(r.status===201){const data=await r.json();const media=await mf.dispatchFetch('http://bench.local'+data.url);assert.equal(media.status,200);const downloaded=Buffer.from(await media.arrayBuffer());
      const sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(downloaded),sha(bytes));integrity=true;
      assert.equal((await mf.dispatchFetch('http://bench.local/api/posts/'+data.id,{method:'DELETE',headers:{authorization:`Bearer ${token}`}})).status,200);
    }
    results.checks.push({mime:f.mime,size:f.size,decodeVerified:f.decodeVerified,status:r.status,roundTripSha256Match:integrity,passed:true});
    console.log('PASS',f.mime,f.size,r.status);
  }
  results.summary={passed:results.checks.length,failed:0};
}catch(e){results.error=String(e.stack||e);process.exitCode=1;console.error(e);}
finally{await fs.writeFile(path.join(output,'valid-media-results.json'),JSON.stringify(results,null,2));await mf.dispose();}
