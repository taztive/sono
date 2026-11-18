import http from 'node:http';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Store } from './store.mjs';
import { generateOutline } from './model.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=s=>createHash('sha256').update(s).digest('hex');
const secureEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function createApp({dataDir=join(homedir(),'.sono-studio'),host='127.0.0.1',secure=false,origin}={}) {
 mkdirSync(dataDir,{recursive:true,mode:0o700});chmodSync(dataDir,0o700);
 const store=new Store(join(dataDir,'studio.sqlite'));chmodSync(join(dataDir,'studio.sqlite'),0o600);
 const setupToken=store.setting('password')?null:randomBytes(32).toString('hex');
 const attempts=new Map();
 function issueSession(res){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token),csrf,Date.now()+8*3600000);res.setHeader('Set-Cookie',`sono_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure?'; Secure':''}`);return csrf;}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>1_000_000){const e=new Error('データが大きすぎます');e.status=413;throw e;}}try{return JSON.parse(text||'{}');}catch{throw new Error('JSONが不正です');}}
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://images.unsplash.com; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
   const requestOrigin=origin||`http://${req.headers.host}`;
   const url=new URL(req.url,requestOrigin),path=url.pathname;
   if(!origin&&!/^127\.0\.0\.1:\d+$|^localhost:\d+$|^\[::1\]:\d+$/.test(req.headers.host||'')){json(res,403,{error:'許可されていないホストです'});return;}
   const writes=!['GET','HEAD'].includes(req.method);
   if(writes){if(req.headers.origin!==requestOrigin){json(res,403,{error:'Originの検証に失敗しました'});return;}if(!String(req.headers['content-type']).startsWith('application/json')){json(res,415,{error:'JSONが必要です'});return;}}
   const cookie=(req.headers.cookie||'').match(/(?:^|; )sono_session=([a-f0-9]{64})(?:;|$)/)?.[1];
   const session=cookie?store.db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(sha(cookie),Date.now()):null;
   if(path==='/api/session'&&req.method==='GET'){json(res,200,{authenticated:!!session,setupRequired:!store.setting('password'),csrf:session?.csrf||null,mode:origin?'hosted':'local',publicUrl:'/plans',connections:{instagram:false,youtube:false,tiktok:false}});return;}
   if((path==='/api/setup'||path==='/api/login')&&req.method==='POST'){
    const ip=req.socket.remoteAddress;const rate=attempts.get(ip)||{n:0,until:Date.now()+900000};if(rate.until<Date.now()){rate.n=0;rate.until=Date.now()+900000;}rate.n++;attempts.set(ip,rate);if(rate.n>12){json(res,429,{error:'試行回数が多すぎます。15分後に再試行してください'});return;}
    const b=await body(req);if(typeof b.password!=='string'||b.password.length>512)throw new Error('パスワードを確認してください');
    if(path==='/api/setup'){
     if(store.setting('password')||!setupToken||typeof b.token!=='string'||!secureEqual(b.token,setupToken)){json(res,403,{error:'初期設定リンクが無効です'});return;}
     if(b.password.length<12)throw new Error('パスワードは12文字以上にしてください');
     const salt=randomBytes(16).toString('hex');store.setting('password',`${salt}:${scryptSync(b.password,salt,64).toString('hex')}`);
    }else{
     const saved=store.setting('password');if(!saved){json(res,403,{error:'初期設定を完了してください'});return;}const [salt,key]=saved.split(':');if(!secureEqual(scryptSync(b.password,salt,64).toString('hex'),key)){json(res,401,{error:'パスワードが違います'});return;}
    }
    attempts.delete(ip);json(res,200,{csrf:issueSession(res)});return;
   }
   if(path.startsWith('/api/admin/')){
    if(!session){json(res,401,{error:'ログインしてください'});return;}
    if(writes&&!secureEqual(String(req.headers['x-csrf-token']||''),session.csrf)){json(res,403,{error:'セッションを再読み込みしてください'});return;}
    if(path==='/api/admin/logout'&&req.method==='POST'){store.db.prepare('DELETE FROM sessions WHERE hash=?').run(session.hash);res.setHeader('Set-Cookie','sono_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');json(res,200,{ok:true});return;}
    if(path==='/api/admin/records'){
     if(req.method==='GET'){json(res,200,store.list());return;}
     if(req.method==='POST'){json(res,201,store.save(await body(req)));return;}
    }
    const match=path.match(/^\/api\/admin\/records\/([a-f0-9-]+)(?:\/(publish|unpublish|archive|restore|duplicate|outline))?$/);
    if(match){const [,id,action]=match;const p=store.get(id);if(!p){json(res,404,{error:'見つかりません'});return;}
     if(req.method==='PUT'&&!action){const b=await body(req);if(b.kind!==p.kind)throw new Error('コンテンツの種類は変更できません');json(res,200,store.save(b,id,b.revision));return;}
     if(req.method==='POST'&&action){const b=await body(req);if(action==='outline'){json(res,200,{blocks:generateOutline(p),method:'editorial-template',note:'編集テンプレートから作成。取材・出典確認が必要です。'});return;}json(res,200,action==='publish'?store.publish(id,b.revision):store.action(id,action,b.revision));return;}
    }
    if(path==='/api/admin/schedules') {if(req.method==='GET'){json(res,200,store.schedules());return;}if(req.method==='POST'){json(res,201,store.schedule(await body(req)));return;}}
    const cancel=path.match(/^\/api\/admin\/schedules\/([a-f0-9-]+)\/cancel$/);if(cancel&&req.method==='POST'){store.cancel(cancel[1]);json(res,200,{ok:true});return;}
    if(path==='/api/admin/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="sono-studio-backup.json"');json(res,200,{version:1,exportedAt:new Date().toISOString(),records:store.list(),schedules:store.schedules()});return;}
    if(path==='/api/admin/audit'&&req.method==='GET'){json(res,200,store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all());return;}
    json(res,404,{error:'見つかりません'});return;
   }
   if(path==='/api/plans'&&req.method==='GET'){json(res,200,store.publicList());return;}
   // Only explicit assets can be served; databases, source, tests and backups are never static files.
   const assets={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/script.js':'script.js','/sono-logo.svg':'sono-logo.svg','/sono-mark.svg':'sono-mark.svg','/admin':'admin/index.html','/admin/':'admin/index.html','/admin/app.js':'admin/app.js','/admin/studio.css':'admin/studio.css','/plans':'admin/plans.html','/plans.js':'admin/plans.js'};
   if(assets[path]&&['GET','HEAD'].includes(req.method)){
    const file=assets[path],ext=file.split('.').pop();res.setHeader('Content-Type',({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'})[ext]);res.statusCode=200;res.end(req.method==='HEAD'?'':readFileSync(join(root,file)));return;
   }
   json(res,404,{error:'見つかりません'});
  }catch(e){json(res,e.status||400,{error:e.message||'処理できませんでした'});}
 });
 return {server,store,setupToken,host};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const origin=process.env.SONO_ORIGIN;const host=process.env.SONO_HOST||'127.0.0.1';
 if(host!=='127.0.0.1'&&!origin)throw new Error('外部公開には HTTPS の SONO_ORIGIN が必要です');
 if(origin&&!/^https:\/\/[^/]+$/.test(origin))throw new Error('SONO_ORIGIN は末尾スラッシュなしの HTTPS オリジンを指定してください');
 const app=createApp({dataDir:process.env.SONO_DATA_DIR,host,origin,secure:!!origin});
 app.server.listen(Number(process.env.PORT)||4318,host,()=>{
  const base=origin||`http://127.0.0.1:${app.server.address().port}`;
  console.log(`SONO Studio: ${base}/admin`);
  if(app.setupToken)console.log(`初回設定（本人専用・共有しない）: ${base}/admin#setup=${app.setupToken}`);
  if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[`${base}/admin${app.setupToken?'#setup='+app.setupToken:''}`],{stdio:'ignore'});
 });
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.server.close(()=>{app.store.close();process.exit(0);}));
}
