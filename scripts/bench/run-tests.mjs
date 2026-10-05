import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../..');
const app = process.env.BENCH_APP || path.join(workspace, '.bench/app');
const require = createRequire(path.join(app, 'package.json'));
const { Miniflare, Log, LogLevel } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const output = path.join(workspace, '.bench/results');
await fs.mkdir(output, { recursive: true });
const SECRET = 'resume-benchmark-isolated-test-secret-20260908';
const SENTINEL = 'sk-resume-test-sentinel-not-a-real-key-20260908';
const PASSWORD = 'Resume-benchmark-password!';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6hXQAAAAASUVORK5CYII=', 'base64');
const results = {
  startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: os.totalmem() / 1024 ** 3, miniflare: '4.20260515.0', workerdCompatibilityDate: '2026-05-15', application: '.bench/app', sourceCommit: JSON.parse(await fs.readFile(path.join(app,'../source-manifest.json'),'utf8')).commit },
  methodology: 'Production-built application including its real Vinext route dispatcher; local workerd, D1 and R2 emulation, ephemeral storage. External AI responses are stubbed. No cloud measurements.',
  checks: [], limitations: [],
};
async function checkpoint() { await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
async function check(name, category, action) {
  const start = performance.now();
  try {
    const detail = await action();
    results.checks.push({ name, category, passed: true, elapsedMs: performance.now() - start, detail });
    console.log('PASS', name);
    return detail;
  } catch (err) {
    results.checks.push({ name, category, passed: false, elapsedMs: performance.now() - start, error: String(err.stack || err) });
    console.log('FAIL', name, err.message);
    throw err;
  } finally { await checkpoint(); }
}
function stats(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const q = p => sorted[Math.ceil(p * sorted.length) - 1];
  return { n: values.length, p50Ms: q(.5), p95Ms: q(.95), p99Ms: q(.99), meanMs: values.reduce((a,b)=>a+b,0)/values.length, minMs: sorted[0], maxMs: sorted.at(-1) };
}
function sign(body, header = { alg: 'HS256', typ: 'JWT' }) {
  const value = [header,body].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return value + '.' + crypto.createHmac('sha256',SECRET).update(value).digest('base64url');
}
let outboundCalls = [];
let providerMode = 'success';
async function collectModules(dir) {
  const list=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())list.push(...await collectModules(p));
    else if(/\.(m?js)$/.test(entry.name))list.push({type:'ESModule',path:p});
  }
  return list;
}
const serverRoot=path.join(app,'dist/server');
const productionModules=(await collectModules(serverRoot)).sort((a,b)=>a.path===path.join(serverRoot,'index.js')?-1:b.path===path.join(serverRoot,'index.js')?1:a.path.localeCompare(b.path));
const options = {
  modules: productionModules, modulesRoot: serverRoot,
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], r2Buckets: ['FILES'],
  bindings: { TOKEN_SECRET: SECRET, OPENAI_API_KEY: SENTINEL },
  log: new Log(LogLevel.ERROR),
  outboundService: async request => {
    const body = await request.json();
    outboundCalls.push({ url: request.url, method: request.method, correctServerCredential: request.headers.get('authorization') === `Bearer ${SENTINEL}`, body });
    if (request.url !== 'https://api.openai.com/v1/images/generations') throw new Error('Unexpected outbound URL');
    if (providerMode === 'missing-image') return Response.json({data:[]});
    if (providerMode.startsWith('status:')) return Response.json({error:'stubbed provider error'}, {status:Number(providerMode.split(':')[1]),headers:{'x-request-id':'isolated-provider-test'}});
    return Response.json({data:[{b64_json:PNG.toString('base64')}]});
  },
};
let mf;
let noKey;
try {
  mf = new Miniflare(options);
  await mf.ready;
  const db = await mf.getD1Database('DB');
  const bucket = await mf.getR2Bucket('FILES');
  const req = async (url,init={}) => {
    // Node and Miniflare use different FormData implementations. Serialize to
    // real multipart HTTP bytes so the production form parser receives a boundary.
    if (init.body instanceof FormData) {
      const native = new Request('http://bench.local'+url,init);
      return mf.dispatchFetch(native.url,{...init,headers:Object.fromEntries(native.headers),body:Buffer.from(await native.arrayBuffer())});
    }
    return mf.dispatchFetch('http://bench.local'+url,init);
  };
  const json = (url,body,token) => req(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  const upload = (token,bytes=PNG,type='image/png',message='benchmark upload',url='/api/posts') => {
    const form = new FormData(); form.set('message',message); form.set('media_file',new File([bytes],type.startsWith('video/')?'fixture.mp4':'fixture.png',{type}));
    return req(url,{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:form});
  };
  const get = (url,token) => req(url,{headers:token?{authorization:`Bearer ${token}`}:{}});
  const del = (id,token,legacy=false) => req(`${legacy?'/post/':'/api/posts/'}${id}`,{method:'DELETE',headers:token?{authorization:`Bearer ${token}`}:{}});
  await check('Create two accounts with the same password', 'setup', async()=>{
    assert.equal((await json('/api/auth/signup',{username:'alice',password:PASSWORD})).status,201);
    assert.equal((await json('/api/auth/signup',{username:'bob',password:PASSWORD})).status,201);
  });
  let alice,bob;
  await check('Authenticate both accounts', 'setup', async()=>{
    const a=await json('/api/auth/signin',{username:'alice',password:PASSWORD});assert.equal(a.status,200);alice=(await a.json()).token;
    const b=await json('/api/auth/signin',{username:'bob',password:PASSWORD});assert.equal(b.status,200);bob=(await b.json()).token;
  });
  await check('Independent password derivation and random salts', 'crypto', async()=>{
    const {results:users}=await db.prepare('SELECT username,password_hash FROM users ORDER BY username').all();
    assert.equal(users.length,2);assert.notEqual(users[0].password_hash,users[1].password_hash);
    for (const user of users) {
      const [saltText,hashText]=user.password_hash.split('.');const salt=Buffer.from(saltText,'base64url');const hash=Buffer.from(hashText,'base64url');
      assert.equal(salt.length,16);assert.equal(hash.length,32);
      assert.deepEqual(crypto.pbkdf2Sync(PASSWORD,salt,100000,32,'sha256'),hash);
    }
    return {accounts:2,saltBits:128,derivedKeyBits:256,independentlyVerifiedIterations:100000};
  });
  await check('JWT signature and expiry interval', 'crypto', async()=>{
    const before=Math.floor(Date.now()/1000);const res=await json('/api/auth/signin',{username:'alice',password:PASSWORD});const token=(await res.json()).token;const after=Math.floor(Date.now()/1000);
    const [header,payload,sig]=token.split('.');const parsed=JSON.parse(Buffer.from(payload,'base64url'));
    assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'HS256');
    assert.equal(sig,crypto.createHmac('sha256',SECRET).update(header+'.'+payload).digest('base64url'));
    assert.ok(parsed.exp-before>=86400&&parsed.exp-after<=86400);
    return {ttlSeconds:86400,ttlHours:24,signatureVerifiedIndependently:true};
  });
  // Each negative case has a concrete expected status, and protected data is checked afterward.
  await check('Wrong password is rejected', 'authorization', async()=>assert.equal((await json('/api/auth/signin',{username:'alice',password:'incorrect'})).status,401));
  await check('Unknown account is rejected', 'authorization', async()=>assert.equal((await json('/api/auth/signin',{username:'nobody',password:PASSWORD})).status,401));
  const probeResponse=await upload(alice);const probe=await probeResponse.json();assert.equal(probeResponse.status,201,JSON.stringify(probe));assert.ok(probe.id);
  const authCases = [
    ['missing token',undefined],
    ['expired token',sign({username:'alice',exp:Math.floor(Date.now()/1000)-1})],
    ['expiry at current second',sign({username:'alice',exp:Math.floor(Date.now()/1000)})],
    ['tampered payload',alice.split('.')[0]+'.'+Buffer.from(JSON.stringify({username:'bob',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.'+alice.split('.')[2]],
    ['invalid signature',alice.slice(0,-8)+'AAAAAAAA'],
    ['malformed token','not.a.jwt.extra'],
  ];
  for(const [name,t] of authCases) {
    await check('Reject '+name+' on protected operations','authorization',async()=>{
      const statuses=[(await get('/api/posts',t)).status,(await upload(t)).status,(await del(probe.id,t)).status,(await json('/api/generate',{prompt:'test'},t)).status];
      assert.deepEqual(statuses,[401,401,401,401]);return {requests:4,statuses};
    });
  }
  await check('Non-owner deletion preserves both metadata and object', 'authorization', async()=>{
    assert.equal((await del(probe.id,bob)).status,404);
    const row=await db.prepare('SELECT object_key FROM posts WHERE id=?').bind(probe.id).first();assert.ok(row);
    assert.ok(await bucket.head(row.object_key));assert.equal((await get(probe.url)).status,200);
  });
  await check('Valid owner can delete both metadata and object', 'authorization-positive', async()=>{
    const row=await db.prepare('SELECT object_key FROM posts WHERE id=?').bind(probe.id).first();assert.equal((await del(probe.id,alice)).status,200);
    assert.equal(await db.prepare('SELECT id FROM posts WHERE id=?').bind(probe.id).first(),null);assert.equal(await bucket.head(row.object_key),null);
  });
  await check('Legacy signup preserves success/duplicate contracts', 'legacy', async()=>{
    const res=await json('/signup',{username:'legacyuser',password:PASSWORD});assert.equal(res.status,200);assert.equal(await res.text(),'');assert.equal(res.headers.get('access-control-allow-origin'),'*');
    assert.equal((await json('/signup',{username:'legacyuser',password:PASSWORD})).status,400);
  });
  let legacyToken,legacyPost;
  await check('Legacy signin returns a plain-text bearer token','legacy',async()=>{
    const res=await json('/signin',{username:'legacyuser',password:PASSWORD});assert.equal(res.status,200);assert.ok(res.headers.get('content-type').includes('text/plain'));legacyToken=await res.text();assert.equal(legacyToken.split('.').length,3);
  });
  await check('Legacy upload preserves empty 200 response','legacy',async()=>{
    const res=await upload(legacyToken,PNG,'image/png','legacy searchable fixture','/upload');assert.equal(res.status,200);assert.equal(await res.text(),'');
  });
  await check('Legacy search returns persisted posts and required fields','legacy',async()=>{
    const res=await get('/search?user=legacyuser',legacyToken);assert.equal(res.status,200);const posts=await res.json();assert.equal(posts.length,1);legacyPost=posts[0];
    for(const key of ['id','user','message','type','url'])assert.ok(key in legacyPost);
  });
  await check('Legacy deletion enforces ownership and empty 200 response','legacy',async()=>{
    assert.equal((await del(legacyPost.id,alice,true)).status,404);const res=await del(legacyPost.id,legacyToken,true);assert.equal(res.status,200);assert.equal(await res.text(),'');
    assert.equal((await get(legacyPost.url)).status,404);
  });
  await check('All five legacy endpoints answer CORS preflight','legacy-preflight',async()=>{
    for(const url of ['/signup','/signin','/upload','/search','/post/example']) {
      const r=await req(url,{method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-methods'),'GET, POST, DELETE, OPTIONS');
    }
    return {endpoints:5};
  });
  const limit=25*1024*1024;
  results.uploadBoundaries=[];
  for(const mime of ['image/png','video/mp4']) {
    for(const size of [0,1,limit-1,limit,limit+1]) {
      await check(`Upload ${mime} size ${size}`, 'upload-boundary', async()=>{
        const bytes=Buffer.alloc(size,97);if(size>=PNG.length&&mime==='image/png')PNG.copy(bytes);
        const beforeCount=(await db.prepare('SELECT count(*) AS n FROM posts').first()).n;
        const start=performance.now();const res=await upload(alice,bytes,mime);const elapsed=performance.now()-start;
        const expected=size>0&&size<=limit?201:400;assert.equal(res.status,expected);
        if(expected===201) {
          const post=await res.json();const media=await get(post.url);assert.equal(media.status,200);const downloaded=Buffer.from(await media.arrayBuffer());
          assert.equal(downloaded.length,size);assert.equal(crypto.createHash('sha256').update(downloaded).digest('hex'),crypto.createHash('sha256').update(bytes).digest('hex'));
          assert.equal((await del(post.id,alice)).status,200);
        }
        assert.equal((await db.prepare('SELECT count(*) AS n FROM posts').first()).n,beforeCount);
        const record={mime,size,status:res.status,roundTripByteIntegrity:expected===201,uploadResponseMs:elapsed};results.uploadBoundaries.push(record);return record;
      });
    }
  }
  await check('Non-media MIME is rejected without persistence','upload-validation',async()=>assert.equal((await upload(alice,Buffer.from('plain text'),'text/plain')).status,400));
  await check('Message length boundary is enforced','upload-validation',async()=>{
    const ok=await upload(alice,PNG,'image/png','a'.repeat(500));assert.equal(ok.status,201);await del((await ok.json()).id,alice);
    assert.equal((await upload(alice,PNG,'image/png','a'.repeat(501))).status,400);
    assert.equal((await upload(alice,PNG,'image/png','   ')).status,400);
    return {acceptedCharacters:500,rejectedCharacters:501};
  });
  await check('Fifty injected database insert failures leave no orphan objects','failure-cleanup',async()=>{
    const beforeObjects=(await bucket.list()).objects.map(x=>x.key).sort();const beforeRows=(await db.prepare('SELECT count(*) AS n FROM posts').first()).n;
    await db.exec("CREATE TRIGGER bench_fail_post BEFORE INSERT ON posts WHEN NEW.message = 'forced-insert-failure' BEGIN SELECT RAISE(ABORT, 'injected insert failure'); END;");
    const samples=[];
    for(let i=0;i<50;i++) {
      const start=performance.now();const response=await upload(alice,PNG,'image/png','forced-insert-failure');assert.equal(response.status,500);samples.push(performance.now()-start);
      assert.deepEqual((await bucket.list()).objects.map(x=>x.key).sort(),beforeObjects);assert.equal((await db.prepare('SELECT count(*) AS n FROM posts').first()).n,beforeRows);
    }
    await db.exec('DROP TRIGGER bench_fail_post;');
    const result={injectedFailures:50,http500Responses:50,orphanObjects:0,orphanRows:0,latency:stats(samples)};results.failureCleanup=result;return result;
  });
  await check('Recovery after injected failures allows successful upload','failure-recovery',async()=>{
    const r=await upload(alice);assert.equal(r.status,201);await del((await r.json()).id,alice);
  });
  await check('Media cache headers and conditional response behavior','media-cache',async()=>{
    const post=await (await upload(alice)).json();const first=await get(post.url);const firstBody=await first.arrayBuffer();const etag=first.headers.get('etag');assert.ok(etag);
    assert.equal(first.headers.get('cache-control'),'public, max-age=3600, stale-while-revalidate=86400');
    const conditional=await req(post.url,{headers:{'if-none-match':etag}});const bytes=(await conditional.arrayBuffer()).byteLength;
    results.mediaCache={cacheControl:first.headers.get('cache-control'),etagPresent:true,conditionalStatus:conditional.status,conditionalBodyBytes:bytes,originalBodyBytes:firstBody.byteLength};
    if(conditional.status!==304)results.limitations.push('Media handler sends ETag but does not implement conditional 304 responses. Header TTL is not a measured cache hit-rate or bandwidth reduction.');
    await del(post.id,alice);return results.mediaCache;
  });
  // Only provider I/O is stubbed; authentication, route parsing, translation and persistence are real.
  await check('AI proxy success preserves response and uses server-only credential','ai-proxy',async()=>{
    providerMode='success';outboundCalls=[];const res=await json('/api/generate',{prompt:'integration fixture'},alice);assert.equal(res.status,200);const body=await res.json();
    assert.equal(body.image,'data:image/png;base64,'+PNG.toString('base64'));assert.equal(outboundCalls.length,1);assert.equal(outboundCalls[0].correctServerCredential,true);
    assert.deepEqual(outboundCalls[0].body,{model:'gpt-image-2',prompt:'integration fixture',n:1,size:'1024x1024'});assert.ok(!JSON.stringify(body).includes(SENTINEL));
    const uploaded=await upload(alice,Buffer.from(body.image.split(',')[1],'base64'));assert.equal(uploaded.status,201);const post=await uploaded.json();
    assert.deepEqual(Buffer.from(await (await get(post.url)).arrayBuffer()),PNG);await del(post.id,alice);
    return {realProviderCall:false,stubbedProviderCalls:1,generatedFixtureBytes:PNG.length};
  });
  for(const status of [401,429,500])await check(`AI upstream ${status} maps to 502`,'ai-proxy',async()=>{
    providerMode='status:'+status;const r=await json('/api/generate',{prompt:'fixture'},alice);assert.equal(r.status,502);assert.ok(!(await r.text()).includes(SENTINEL));
  });
  await check('AI response missing image maps to 502','ai-proxy',async()=>{providerMode='missing-image';assert.equal((await json('/api/generate',{prompt:'fixture'},alice)).status,502);});
  await check('AI empty prompt is rejected without provider calls','ai-proxy',async()=>{const before=outboundCalls.length;assert.equal((await json('/api/generate',{prompt:''},alice)).status,400);assert.equal(outboundCalls.length,before);});
  await check('AI invalid JSON is rejected without provider calls','ai-proxy',async()=>{const before=outboundCalls.length;assert.equal((await req('/api/generate',{method:'POST',headers:{authorization:`Bearer ${alice}`,'content-type':'application/json'},body:'{'})).status,400);assert.equal(outboundCalls.length,before);});
  await check('AI missing key returns 503 without provider calls','ai-proxy',async()=>{
    noKey=new Miniflare({...options,bindings:{TOKEN_SECRET:SECRET}});await noKey.ready;
    const res=await noKey.dispatchFetch('http://bench.local/api/generate',{method:'POST',headers:{authorization:`Bearer ${alice}`,'content-type':'application/json'},body:JSON.stringify({prompt:'fixture'})});assert.equal(res.status,503);await noKey.dispose();noKey=null;
  });
  await check('Scan production client JavaScript for test credential leakage','client-bundle',async()=>{
    async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
    const all=await walk(path.join(app,'dist/client'));const js=all.filter(f=>f.endsWith('.js'));assert.ok(js.length>0);
    const leaks=[];let bytes=0;let proxyFound=false;
    for(const f of js){const b=await fs.readFile(f);const s=b.toString();bytes+=b.length;if(s.includes(SENTINEL)||s.includes(SECRET))leaks.push(path.relative(app,f));if(s.includes('/api/generate'))proxyFound=true;}
    assert.deepEqual(leaks,[]);assert.equal(proxyFound,true);
    results.clientBundle={javascriptFiles:js.length,javascriptBytes:bytes,credentialMatches:0,proxyPathPresent:true};return results.clientBundle;
  });
  // Clear only this ephemeral database, then seed a deterministic uniform author distribution.
  await db.exec('DELETE FROM posts;');
  await check('Seed exactly 100000 searchable metadata rows','dataset',async()=>{
    await db.prepare(`WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM n WHERE i<99999)
      INSERT INTO posts(id,user,message,media_type,object_key,content_type,created_at)
      SELECT printf('seed-%06d',i),printf('author%04d',i%1000),
      CASE WHEN i%100=0 THEN 'alpha beta gamma delta epsilon zeta eta theta' ELSE printf('landscape city portrait group%d',i%20) END,
      CASE WHEN i%2=0 THEN 'image' ELSE 'video' END,printf('seed/object-%06d',i),'image/png',strftime('%Y-%m-%dT%H:%M:%fZ','2025-01-01','+'||i||' seconds') FROM n;`).run();
    const counts=await db.prepare('SELECT count(*) AS rows,count(DISTINCT user) AS authors FROM posts').first();assert.deepEqual(counts,{rows:100000,authors:1000});
    await db.exec('ANALYZE;');results.dataset={...counts,postsPerAuthor:100,synthetic:true};return results.dataset;
  });
  await check('Search correctness on seeded dataset including injection text','search-correctness',async()=>{
    const byUser=await (await get('/api/posts?user=author0421',alice)).json();assert.equal(byUser.length,100);assert.ok(byUser.every(p=>p.user==='author0421'));
    assert.ok(byUser.every((p,i)=>i===0||p.createdAt<=byUser[i-1].createdAt));
    const key=await (await get('/api/posts?keywords=alpha%20theta',alice)).json();assert.equal(key.length,100);assert.ok(key.every(p=>p.message.includes('alpha')&&p.message.includes('theta')));
    const eight='alpha beta gamma delta epsilon zeta eta theta';const eightRes=await (await get('/api/posts?keywords='+encodeURIComponent(eight),alice)).json();assert.equal(eightRes.length,100);
    const ninth=await (await get('/api/posts?keywords='+encodeURIComponent(eight+' NONEXISTENT'),alice)).json();assert.deepEqual(ninth,eightRes);
    const injection=await (await get('/api/posts?keywords='+encodeURIComponent("' OR 1=1 --"),alice)).json();assert.deepEqual(injection,[]);
    results.limitations.push('Keyword search uses substring matching, caps input at eight terms and results at 100. It is not full-text indexed search; a ninth term is silently ignored.');
    return {authorMatches:100,eightTermMatches:100,ninthTermIgnored:true,sqlInjectionTextResults:0};
  });
  console.log('Starting isolated query benchmark: 500 paired queries and 3 x 200 endpoint requests.');
  const select='SELECT id, user, message, media_type, object_key, content_type, created_at FROM posts';
  const suffix=' WHERE user = ? ORDER BY created_at DESC LIMIT 100';
  const indexed=select+suffix,control=select+' NOT INDEXED'+suffix;
  await check('Measure composite index against an unindexed control','index-benchmark',async()=>{
    const plans={indexed:(await db.prepare('EXPLAIN QUERY PLAN '+indexed).bind('author0421').all()).results,control:(await db.prepare('EXPLAIN QUERY PLAN '+control).bind('author0421').all()).results};
    assert.ok(JSON.stringify(plans.indexed).includes('idx_posts_user_created'));assert.ok(JSON.stringify(plans.control).includes('SCAN posts'));
    for(let i=0;i<20;i++){await db.prepare(indexed).bind('author0421').all();await db.prepare(control).bind('author0421').all();}
    const samples=[];
    for(let i=0;i<500;i++) {
      const author='author'+String((i*37)%1000).padStart(4,'0');let a,b,at,bt;
      if(i%2===0){at=performance.now();a=await db.prepare(indexed).bind(author).all();at=performance.now()-at;bt=performance.now();b=await db.prepare(control).bind(author).all();bt=performance.now()-bt;}
      else{bt=performance.now();b=await db.prepare(control).bind(author).all();bt=performance.now()-bt;at=performance.now();a=await db.prepare(indexed).bind(author).all();at=performance.now()-at;}
      assert.deepEqual(a.results,b.results);assert.equal(a.results.length,100);samples.push({i,author,indexedMs:at,unindexedMs:bt,indexedMeta:a.meta,unindexedMeta:b.meta});
    }
    const ai=stats(samples.map(v=>v.indexedMs)),bi=stats(samples.map(v=>v.unindexedMs));
    results.indexBenchmark={datasetRows:100000,pairedQueries:500,warmupQueriesPerVariant:20,order:'alternating AB/BA',measurement:'D1 query plus local Node/workerd bridge; excludes HTTP route/auth/schema overhead',plans,indexed:ai,unindexed:bi,p95ReductionPercent:100*(1-ai.p95Ms/bi.p95Ms),p95Speedup:bi.p95Ms/ai.p95Ms};
    await fs.writeFile(path.join(output,'index-samples.json'),JSON.stringify(samples,null,2));
    return results.indexBenchmark;
  });
  results.endpointBenchmarks={};
  for(const [label,url] of [['author','/api/posts?user=author0421'],['twoKeywords','/api/posts?keywords=alpha%20theta'],['noMatch','/api/posts?keywords=nonexistentzzz']]) {
    await check('End-to-end local handler latency '+label,'endpoint-benchmark',async()=>{
      for(let i=0;i<20;i++)await(await get(url,alice)).arrayBuffer();
      const times=[];
      for(let i=0;i<200;i++){const start=performance.now();const r=await get(url,alice);assert.equal(r.status,200);const data=await r.json();assert.equal(data.length,label==='noMatch'?0:100);times.push(performance.now()-start);}
      results.endpointBenchmarks[label]={...stats(times),warmupRequests:20,concurrency:1,rows:100000};
      await fs.writeFile(path.join(output,`endpoint-${label}-samples.json`),JSON.stringify(times));return results.endpointBenchmarks[label];
    });
  }
  results.limitations.push('25 MiB byte-boundary fixtures test transport, storage and round-trip integrity, not whether content is a valid playable video/image. MIME is supplied by the client, and the application does not inspect file signatures.');
  results.limitations.push('The AI provider is stubbed: no live generation latency, image-quality score or paid-provider throughput is claimed.');
  results.finishedAt=new Date().toISOString();results.summary={checks:results.checks.length,passed:results.checks.filter(x=>x.passed).length,failed:results.checks.filter(x=>!x.passed).length};
  await checkpoint();console.log('DONE',JSON.stringify(results.summary));
} catch(error) {
  results.fatalError=String(error.stack||error);await checkpoint();console.error(error);process.exitCode=1;
} finally { if(noKey)await noKey.dispose();if(mf)await mf.dispose(); }
