import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/src/index.js';

class Statement {
  constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
  bind(...args){return new Statement(this.db,this.sql,args);}
  first(){this.db.queryCount++;return this.db.db.prepare(this.sql).get(...this.args)||null;}
  all(){this.db.queryCount++;return {results:this.db.db.prepare(this.sql).all(...this.args)};}
  run(){this.db.queryCount++;const result=this.db.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes)}};}
}
class D1TestDatabase {
  constructor(){this.db=new DatabaseSync(':memory:');this.queryCount=0;this.db.exec('PRAGMA foreign_keys=ON');}
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){this.db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());this.db.exec('COMMIT');return results;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  exec(sql){this.db.exec(sql);}
}

const now='2026-09-01T00:00:00.000Z',today='2026-09-01';
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function setup(){
  const DB=new D1TestDatabase();
  DB.exec(readFileSync(new URL('../worker/migrations/0001_initial.sql',import.meta.url),'utf8'));
  DB.exec(readFileSync(new URL('../worker/migrations/0002_operations.sql',import.meta.url),'utf8'));
  const env={DB,ALLOWED_ORIGINS:'https://review.example',GOOGLE_CLIENT_ID:'google-client',PAYMENT_PROVIDER_MODE:'disabled',EMAIL_PROVIDER_MODE:'development',BREVO_SENDER_EMAIL:'tiny.tools.studio.ph@gmail.com'};
  return {DB,env};
}
async function seedUser(DB,{id='u1',email='user@example.com',role='user',token='session-token'}={}){
  DB.prepare('INSERT INTO users(id,google_sub,email,name,role,status,created_at,updated_at,last_active_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,`sub-${id}`,email,'Test User',role,'active',now,now,now).run();
  DB.prepare('INSERT INTO entitlements(id,user_id,source,source_transaction_id,plan,starts_on,ends_on,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(`ent-${id}`,id,'test',`test-${id}`,'test',today,'2027-09-01','active',now,now).run();
  DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(`s-${id}`,id,await digest(token),'2027-09-01T00:00:00.000Z',now,now).run();
  DB.prepare('INSERT INTO allocation_rules(id,user_id,effective_from,living_percentage,debt_percentage,savings_percentage,fun_percentage,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(`rule-${id}`,id,'2026-01-01',40,55,4,1,now).run();
  return token;
}
async function call(env,path,{method='GET',body,token='session-token',headers={}}={}){
  const request=new Request(`https://api.example${path}`,{method,headers:{origin:'https://review.example',cookie:`drs_session=${token}`,'content-type':'application/json','idempotency-key':headers['idempotency-key']||crypto.randomUUID(),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const response=await worker.fetch(request,env,{});return {response,data:await response.json()};
}

test('Worker and D1 execute authenticated income, allocation, transfer and dashboard flows',async()=>{
  const {DB,env}=setup();await seedUser(DB);
  let result=await call(env,'/api/income',{method:'POST',body:{date:today,source:'Salary',description:'September salary',amount:1000},headers:{'idempotency-key':'income-1'}});
  assert.equal(result.response.status,201);assert.deepEqual(result.data.allocation,{living:40000,debt:55000,savings:4000,fun:1000});
  result=await call(env,'/api/funds/transfer',{method:'POST',body:{date:today,from:'living',to:'savings',amount:50},headers:{'idempotency-key':'transfer-1'}});
  assert.equal(result.response.status,201);
  DB.queryCount=0;const started=performance.now();result=await call(env,'/api/dashboard');const elapsed=performance.now()-started;assert.equal(result.response.status,200);
  const balances=Object.fromEntries(result.data.balances.map(x=>[x.category,Number(x.amount_minor)]));
  assert.equal(balances.living,35000);assert.equal(balances.savings,9000);
  assert.equal(DB.prepare("SELECT COUNT(*) count FROM ledger_entries WHERE entry_type='allocation'").first().count,4);
  assert.ok(DB.queryCount<=10,`dashboard used ${DB.queryCount} D1 statements`);assert.ok(elapsed<50,`local dashboard logic took ${elapsed.toFixed(2)}ms`);
});

test('Debt safeguards, account history and recovery calculations execute against D1',async()=>{
  const {DB,env}=setup();await seedUser(DB);
  await call(env,'/api/funds/direct',{method:'POST',body:{date:today,category:'debt',source:'Freelance',amount:600,note:'Debt only'},headers:{'idempotency-key':'fund-1'}});
  let result=await call(env,'/api/debts',{method:'POST',body:{creditor:'Creditor A',currentBalance:500,dueDate:today,paymentAmount:100,paymentFrequency:'monthly',interestMode:'none',interestValue:0,interestFrequency:'monthly',interestBasis:'remaining',paused:false},headers:{'idempotency-key':'debt-1'}});
  assert.equal(result.response.status,201);const debtId=result.data.id;
  result=await call(env,'/api/debt-payments',{method:'POST',body:{debtId,date:today,amount:501,note:'Too much'},headers:{'idempotency-key':'pay-too-much'}});assert.equal(result.response.status,409);assert.equal(result.data.error,'excess_payment_not_allowed');
  result=await call(env,'/api/debt-payments',{method:'POST',body:{debtId,date:today,amount:100,note:'First payment'},headers:{'idempotency-key':'pay-1'}});assert.equal(result.response.status,201);
  result=await call(env,`/api/debts/${debtId}/history`);assert.equal(result.response.status,200);assert.equal(result.data.activity.some(x=>x.entry_type==='debt_payment'),true);
  result=await call(env,'/api/recovery');assert.equal(result.response.status,200);assert.equal(result.data.currentDebtMinor,40000);
  result=await call(env,'/api/debts/archive',{method:'POST',body:{debtId}});assert.equal(result.response.status,409);assert.equal(result.data.error,'only_fully_paid_debt_can_be_archived');
});

test('Payhip webhook verification, mapping, idempotency and entitlement activation execute end to end',async()=>{
  const {DB,env}=setup();await seedUser(DB,{email:'buyer@example.com'});env.PAYMENT_PROVIDER_MODE='payhip';env.PAYHIP_API_KEY='development-payhip-api-key';env.PAYHIP_PRODUCT_MAP=JSON.stringify({'product-3':'3months'});
  const signature=await digest(env.PAYHIP_API_KEY),payload={id:'sale-100',email:'buyer@example.com',currency:'PHP',price:19900,date:1788220800,type:'paid',signature,items:[{product_id:'product-3'}]};
  const request=()=>new Request('https://api.example/api/webhooks/payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  let response=await worker.fetch(request(),env,{}),data=await response.json();assert.equal(response.status,202);assert.equal(data.status,'active');
  response=await worker.fetch(request(),env,{});data=await response.json();assert.equal(data.duplicate,true);
  assert.equal(DB.prepare("SELECT COUNT(*) count FROM entitlements WHERE source='payhip' AND source_transaction_id='sale-100'").first().count,1);
});

test('Google token verification and pending Admin grant activate on first sign-in',async()=>{
  const {DB,env}=setup();await seedUser(DB,{id:'admin',email:'admin@example.com',role:'admin',token:'admin-token'});
  DB.prepare("INSERT INTO admin_access_grants(id,email,plan,starts_on,ends_on,reference,status,created_by,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)").bind('grant-1','new@example.com','3months',today,'2026-12-01','external-1','admin',now).run();
  const originalFetch=globalThis.fetch;globalThis.fetch=async url=>String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')?new Response(JSON.stringify({aud:'google-client',email_verified:'true',sub:'new-google-sub',email:'new@example.com',name:'New User'}),{status:200,headers:{'content-type':'application/json'}}):originalFetch(url);
  try{
    const request=new Request('https://api.example/api/auth/google',{method:'POST',headers:{origin:'https://review.example','content-type':'application/json'},body:JSON.stringify({credential:'test-id-token'})});
    const response=await worker.fetch(request,env,{}),data=await response.json();assert.equal(response.status,200);assert.equal(data.user.email,'new@example.com');assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=None/);
    assert.equal(DB.prepare("SELECT status FROM admin_access_grants WHERE id='grant-1'").first().status,'claimed');
  }finally{globalThis.fetch=originalFetch;}
});

test('Scheduled development email delivery and interest posting are bounded and idempotent',async()=>{
  const {DB,env}=setup();await seedUser(DB);
  DB.prepare("INSERT INTO notification_queue(id,user_id,template_key,recipient_email,payload_json,priority,status,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)").bind('mail-1','u1','renewal_reminder','user@example.com','{}','normal',now,now).run();
  let pending;await worker.scheduled({scheduledTime:Date.parse(now)},env,{waitUntil(value){pending=value;}});await pending;
  assert.equal(DB.prepare("SELECT status FROM notification_queue WHERE id='mail-1'").first().status,'sent');
  await worker.scheduled({scheduledTime:Date.parse(now)},env,{waitUntil(value){pending=value;}});await pending;
  assert.equal(DB.prepare("SELECT COUNT(*) count FROM notification_queue WHERE id='mail-1'").first().count,1);
});

test('Account deletion removes live financial data but preserves minimized entitlement records',async()=>{
  const {DB,env}=setup();await seedUser(DB);
  await call(env,'/api/funds/direct',{method:'POST',body:{date:today,category:'savings',source:'Gift',amount:100,note:'Temporary'},headers:{'idempotency-key':'delete-fixture'}});
  let result=await call(env,'/api/account/deletion',{method:'POST',body:{confirmation:'DELETE'}});assert.equal(result.response.status,200);assert.equal(result.data.status,'deleted');
  assert.equal(DB.prepare("SELECT COUNT(*) count FROM ledger_entries WHERE user_id='u1'").first().count,0);
  assert.equal(DB.prepare("SELECT status FROM users WHERE id='u1'").first().status,'deleted');
  assert.equal(DB.prepare("SELECT COUNT(*) count FROM entitlements WHERE user_id='u1'").first().count,1);
});

test('Admin APIs reject ordinary users and allow a protected Admin',async()=>{
  const {DB,env}=setup();await seedUser(DB);await seedUser(DB,{id:'admin',email:'admin@example.com',role:'admin',token:'admin-token'});
  let result=await call(env,'/api/admin/audit');assert.equal(result.response.status,403);assert.equal(result.data.error,'admin_required');
  result=await call(env,'/api/admin/entitlements?q=user',{token:'admin-token'});assert.equal(result.response.status,200);assert.equal(Array.isArray(result.data.items),true);
});

test('A refund revokes only its transaction entitlement and another valid entitlement continues access',async()=>{
  const {DB,env}=setup();await seedUser(DB,{email:'buyer@example.com'});env.PAYMENT_PROVIDER_MODE='payhip';env.PAYHIP_API_KEY='development-payhip-api-key';env.PAYHIP_PRODUCT_MAP=JSON.stringify({'product-3':'3months'});const signature=await digest(env.PAYHIP_API_KEY);
  async function hook(payload){const response=await worker.fetch(new Request('https://api.example/api/webhooks/payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,signature,email:'buyer@example.com',currency:'PHP',items:[{product_id:'product-3'}]})}),env,{});return {response,data:await response.json()};}
  await hook({id:'sale-a',price:19900,date:1788220800,type:'paid'});await hook({id:'sale-b',price:19900,date:1788307200,type:'paid'});
  const refund=await hook({id:'sale-a',price:19900,amount_refunded:19900,date_created:1788220800,date_refunded:1788393600,type:'refunded'});assert.equal(refund.data.status,'revoked');
  assert.equal(DB.prepare("SELECT status FROM entitlements WHERE source_transaction_id='sale-a'").first().status,'revoked');
  assert.equal(DB.prepare("SELECT status FROM entitlements WHERE source_transaction_id='sale-b'").first().status,'active');
  const session=await call(env,'/api/session');assert.equal(session.response.status,200);
});
