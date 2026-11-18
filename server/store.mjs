import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { publicPlan, validateRecord } from './model.mjs';
export class Store {
 constructor(path) {
  this.db = new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,published TEXT,revision INTEGER NOT NULL DEFAULT 1,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY,record_id TEXT NOT NULL REFERENCES records(id),platform TEXT NOT NULL,scheduled_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending_connection',snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,action TEXT NOT NULL,record_id TEXT,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
  `);
 }
 setting(key,value) {if(value!==undefined)this.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;}
 log(action,id) {this.db.prepare('INSERT INTO audit(action,record_id,created_at) VALUES(?,?,?)').run(action,id,new Date().toISOString());}
 decode(r) {return r ? {...JSON.parse(r.data),id:r.id,revision:r.revision,archived:!!r.archived,published:r.published?JSON.parse(r.published):null,createdAt:r.created_at,updatedAt:r.updated_at} : null;}
 list() {return this.db.prepare('SELECT * FROM records ORDER BY updated_at DESC').all().map(r=>this.decode(r));}
 get(id) {return this.decode(this.db.prepare('SELECT * FROM records WHERE id=?').get(id));}
 save(input,id,revision) {
  const data=validateRecord(input), now=new Date().toISOString();
  if(id){const r=this.db.prepare('UPDATE records SET data=?,kind=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND archived=0').run(JSON.stringify(data),data.kind,now,id,revision);if(!r.changes){const e=new Error('別の画面で更新されたか、アーカイブされています。再読み込みしてください');e.status=409;throw e;}}
  else {id=randomUUID();this.db.prepare('INSERT INTO records(id,kind,data,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,data.kind,JSON.stringify(data),now,now);}
  this.log('save',id);return this.get(id);
 }
 publish(id,revision) {
  const p=this.get(id);if(!p||p.archived)throw new Error('プランが見つかりません');
  if(p.kind!=='plan')throw new Error('Magazine・動画は投稿予約から管理してください');
  for(const k of ['description','duration','price','included'])if(!p[k])throw new Error('公開には説明・所要時間・料金・含まれる内容を入力してください');
  const snapshot={...publicPlan(p),id,publishedAt:new Date().toISOString()};
  const r=this.db.prepare('UPDATE records SET published=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(snapshot),snapshot.publishedAt,id,revision);
  if(!r.changes){const e=new Error('更新が競合しました。再読み込みしてください');e.status=409;throw e;}
  this.log('publish',id);return this.get(id);
 }
 action(id,action,revision) {
  const p=this.get(id);if(!p)throw new Error('見つかりません');
  if(action==='duplicate')return this.save({...p,title:p.title+'（コピー）',stage:'idea'});
  if(!['archive','restore','unpublish'].includes(action))throw new Error('不正な操作');
  const sql=action==='unpublish'?'published=NULL':`archived=${action==='archive'?1:0},published=NULL`;
  const r=this.db.prepare(`UPDATE records SET ${sql},revision=revision+1,updated_at=? WHERE id=? AND revision=?`).run(new Date().toISOString(),id,revision);
  if(!r.changes){const e=new Error('更新が競合しました');e.status=409;throw e;}
  if(action==='archive')this.db.prepare("UPDATE schedules SET status='cancelled' WHERE record_id=? AND status='pending_connection'").run(id);
  this.log(action,id);return this.get(id);
 }
 publicList() {return this.db.prepare('SELECT published FROM records WHERE published IS NOT NULL AND archived=0').all().map(r=>JSON.parse(r.published));}
 schedules() {return this.db.prepare('SELECT * FROM schedules ORDER BY scheduled_at').all().map(r=>({...r,snapshot:JSON.parse(r.snapshot)}));}
 schedule(input) {
  const p=this.get(input.recordId);
  if(!p||p.archived||p.kind==='plan')throw new Error('投稿するコンテンツを選択してください');
  if(p.stage!=='ready')throw new Error('内容を確認して「投稿準備完了」にしてください');
  if(!['instagram','youtube','tiktok'].includes(input.platform))throw new Error('投稿先を選択してください');
  const d=new Date(input.at);if(!Number.isFinite(d.valueOf())||d.valueOf()<Date.now()+60000)throw new Error('予約日時は1分以上先にしてください');
  const id=randomUUID();
  this.db.prepare('INSERT INTO schedules(id,record_id,platform,scheduled_at,snapshot,created_at) VALUES(?,?,?,?,?,?)').run(id,p.id,input.platform,d.toISOString(),JSON.stringify(p),new Date().toISOString());
  this.log('schedule-pending-connection',p.id);return this.schedules().find(r=>r.id===id);
 }
 cancel(id) {this.db.prepare("UPDATE schedules SET status='cancelled' WHERE id=?").run(id);this.log('cancel-schedule',id);}
 close(){this.db.close();}
}
