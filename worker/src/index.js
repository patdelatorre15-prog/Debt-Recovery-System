const JSON_HEADERS = {'content-type':'application/json; charset=utf-8'};
const SESSION_COOKIE = 'drs_session';
const SESSION_DAYS = 7;

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === 'OPTIONS') return cors(new Response(null,{status:204}),request,env);
      const url = new URL(request.url);
      const route = `${request.method} ${url.pathname}`;
      if(['POST','PUT','DELETE'].includes(request.method)&&route!=='POST /api/webhooks/payment'&&!originAllowed(request,env))return cors(reply({error:'origin_not_allowed'},403),request,env);
      if (route === 'GET /api/health') return reply({ok:true,service:'debt-recovery-system-api'});
      if (route === 'POST /api/auth/google') return cors(await googleLogin(request,env),request,env);
      if (route === 'POST /api/auth/logout') return cors(await logout(request,env),request,env);
      if (route === 'POST /api/webhooks/payment') return cors(await paymentWebhook(request,env),request,env);

      const auth = await requireUser(request,env);
      if (!auth.ok) return cors(auth.response,request,env);
      const {user} = auth;

      if (route === 'GET /api/session') return cors(await sessionInfo(env,user),request,env);
      if (route === 'GET /api/dashboard') return cors(await dashboard(env,user),request,env);
      if (route === 'GET /api/activity') return cors(await listActivity(request,env,user),request,env);
      if (route === 'GET /api/expected-income') return cors(await listExpectedIncome(env,user),request,env);
      if (route === 'POST /api/expected-income') return cors(await saveExpectedIncome(request,env,user),request,env);
      if (route === 'POST /api/expected-income/receive') return cors(await receiveExpectedIncome(request,env,user),request,env);
      if (route === 'POST /api/income') return cors(await recordIncome(request,env,user),request,env);
      if (route === 'POST /api/funds/direct') return cors(await directFunds(request,env,user),request,env);
      if (route === 'POST /api/funds/transfer') return cors(await transferFunds(request,env,user),request,env);
      if (route === 'POST /api/allocation-rules') return cors(await saveAllocationRule(request,env,user),request,env);
      if (route === 'GET /api/goals') return cors(await listGoals(request,env,user),request,env);
      if (route === 'POST /api/goals') return cors(await saveGoal(request,env,user),request,env);
      if (route === 'POST /api/goals/allocate') return cors(await allocateGoalFunds(request,env,user),request,env);
      if (route === 'POST /api/goals/use') return cors(await useGoalFunds(request,env,user),request,env);
      if (route === 'GET /api/living-plans') return cors(await listLivingPlans(env,user),request,env);
      if (route === 'POST /api/living-plans') return cors(await saveLivingPlan(request,env,user),request,env);
      if (route === 'POST /api/living-bills') return cors(await saveLivingBill(request,env,user),request,env);
      if (route === 'POST /api/expenses') return cors(await recordExpense(request,env,user),request,env);
      if (route === 'GET /api/debts') return cors(await listDebts(env,user),request,env);
      if (route === 'POST /api/debts') return cors(await createDebt(request,env,user),request,env);
      if (route === 'POST /api/debt-payments') return cors(await debtPayment(request,env,user),request,env);
      if (route === 'POST /api/debts/agreement') return cors(await updateDebtAgreement(request,env,user),request,env);
      if (route === 'POST /api/debts/archive') return cors(await archiveDebt(request,env,user),request,env);
      if (request.method==='GET' && /^\/api\/debts\/[^/]+\/history$/.test(url.pathname)) return cors(await debtHistory(url.pathname.split('/')[3],env,user),request,env);
      if (route === 'GET /api/recovery') return cors(await recoverySummary(env,user),request,env);
      if (route === 'POST /api/recovery/goal') return cors(await saveRecoveryGoal(request,env,user),request,env);
      if (route === 'GET /api/account/export') return cors(await exportAccount(env,user),request,env);
      if (route === 'POST /api/account/deletion') return cors(await requestAccountDeletion(request,env,user),request,env);
      if (route === 'GET /api/admin/entitlements') return cors(await adminEntitlements(request,env,user),request,env);
      if (route === 'POST /api/admin/entitlements') return cors(await adminSaveEntitlement(request,env,user),request,env);
      if (route === 'POST /api/admin/entitlements/status') return cors(await adminSetEntitlementStatus(request,env,user),request,env);
      if (route === 'GET /api/admin/activation-attention') return cors(await adminActivationAttention(env,user),request,env);
      if (route === 'GET /api/admin/audit') return cors(await adminAudit(request,env,user),request,env);
      if (route === 'POST /api/admin/activation-recovery') return cors(await adminRecoverActivation(request,env,user),request,env);
      return cors(reply({error:'not_found'},404),request,env);
    } catch (error) {
      console.error('request_failed',{name:error.name,message:error.message});
      return cors(reply({error:'internal_error'},500),request,env);
    }
  },
  async scheduled(controller,env,ctx) {
    ctx.waitUntil(runScheduledWork(env,controller.scheduledTime));
  }
};

async function googleLogin(request,env){
  const body=await readJson(request), credential=String(body.credential||'');
  if(!credential)return reply({error:'missing_google_credential'},400);
  const verify=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if(!verify.ok)return reply({error:'invalid_google_credential'},401);
  const claims=await verify.json();
  if(claims.aud!==env.GOOGLE_CLIENT_ID||claims.email_verified!=='true')return reply({error:'google_identity_rejected'},401);
  const now=new Date().toISOString(), userId=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO users(id,google_sub,email,name,created_at,updated_at,last_active_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name,updated_at=excluded.updated_at,last_active_at=excluded.last_active_at`)
    .bind(userId,claims.sub,normalizeEmail(claims.email),String(claims.name||'').slice(0,120),now,now,now).run();
  const user=await env.DB.prepare('SELECT * FROM users WHERE google_sub=?').bind(claims.sub).first();
  await env.DB.prepare(`INSERT OR IGNORE INTO allocation_rules(id,user_id,effective_from,living_percentage,debt_percentage,savings_percentage,fun_percentage,created_at) VALUES(?,?,?,50,20,30,0,?)`).bind(crypto.randomUUID(),user.id,dateOnly(new Date()),now).run();
  await claimAdminGrants(env,user);
  if(body.licenseKey)await claimLicense(env,user,String(body.licenseKey));
  await recoverUserPurchases(env,user);
  const active=await hasActiveEntitlement(env,user);
  if(!active&&user.role!=='admin'){
    const pending=await env.DB.prepare(`SELECT id FROM payment_events WHERE lower(user_email)=? AND status='activation_needs_attention' LIMIT 1`).bind(normalizeEmail(user.email)).first();
    if(pending)return reply({error:'payment_received_access_pending',message:'Payment received—access setup is pending.',paymentEventId:pending.id},409);
    return reply({error:'access_required',email:user.email},403);
  }
  const raw=randomToken(), hash=await sha256(raw), expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),user.id,hash,expires,now,now).run();
  return reply({user:safeUser(user)},{status:200,headers:{'set-cookie':cookie(raw,SESSION_DAYS*86400)}});
}

async function logout(request,env){
  const raw=cookieValue(request.headers.get('cookie'),SESSION_COOKIE);
  if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(raw)).run();
  return reply({ok:true},{headers:{'set-cookie':cookie('',0)}});
}

async function requireUser(request,env){
  const raw=cookieValue(request.headers.get('cookie'),SESSION_COOKIE);
  if(!raw)return {ok:false,response:reply({error:'authentication_required'},401)};
  const now=new Date().toISOString();
  const user=await env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'`).bind(await sha256(raw),now).first();
  if(!user)return {ok:false,response:reply({error:'session_expired'},401,{headers:{'set-cookie':cookie('',0)}})};
  const active=user.role==='admin'||await hasActiveEntitlement(env,user);
  if(!active)return {ok:false,response:reply({error:'access_expired'},403)};
  return {ok:true,user};
}

async function hasActiveEntitlement(env,user){
  const row=await env.DB.prepare(`SELECT id FROM entitlements WHERE user_id=? AND status='active' AND ends_on>=? LIMIT 1`)
    .bind(user.id,dateOnly(new Date())).first();
  return Boolean(row);
}
async function sessionInfo(env,user){const entitlements=await env.DB.prepare(`SELECT id,source,plan,starts_on,ends_on,status FROM entitlements WHERE user_id=? ORDER BY ends_on DESC`).bind(user.id).all();return reply({user:safeUser(user),entitlements:entitlements.results});}

async function dashboard(env,user){
  const [balances,currentDebt,activity,allocation]=await Promise.all([
    env.DB.prepare(`SELECT category,SUM(amount_minor) amount_minor FROM ledger_entries WHERE user_id=? GROUP BY category`).bind(user.id).all(),
    env.DB.prepare(`SELECT COALESCE(SUM(current_balance_minor),0) amount_minor FROM debts WHERE user_id=? AND status IN ('active','paused')`).bind(user.id).first(),
    env.DB.prepare(`SELECT * FROM ledger_entries WHERE user_id=? ORDER BY occurred_on DESC,created_at DESC LIMIT 8`).bind(user.id).all(),
    env.DB.prepare(`SELECT * FROM allocation_rules WHERE user_id=? AND effective_from<=? ORDER BY effective_from DESC,created_at DESC LIMIT 1`).bind(user.id,dateOnly(new Date())).first()
  ]);
  return reply({balances:balances.results,currentDebtMinor:currentDebt.amount_minor,activity:activity.results,allocation});
}

async function listActivity(request,env,user){
  const url=new URL(request.url),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||50),1),100),category=url.searchParams.get('category');
  const statement=category
    ?env.DB.prepare(`SELECT * FROM ledger_entries WHERE user_id=? AND category=? ORDER BY occurred_on DESC,created_at DESC LIMIT ?`).bind(user.id,category,limit)
    :env.DB.prepare(`SELECT * FROM ledger_entries WHERE user_id=? ORDER BY occurred_on DESC,created_at DESC LIMIT ?`).bind(user.id,limit);
  return reply({items:(await statement.all()).results});
}

async function listExpectedIncome(env,user){return reply({items:(await env.DB.prepare(`SELECT * FROM expected_income WHERE user_id=? ORDER BY expected_on DESC,created_at DESC`).bind(user.id).all()).results});}
async function saveExpectedIncome(request,env,user){
  const b=await readJson(request),name=clean(b.name,120),source=clean(b.source,80),amount=moneyMinor(b.amount),expected=validDate(b.expectedOn),now=new Date().toISOString();
  if(!name||!source||amount<=0||!expected)return reply({error:'invalid_expected_income'},400);const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO expected_income(id,user_id,expected_on,name,source,amount_minor,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'expected',?,?)`).bind(id,user.id,expected,name,source,amount,now,now).run();return reply({id,status:'expected'},201);
}
async function receiveExpectedIncome(request,env,user){
  const b=await readJson(request),item=await env.DB.prepare(`SELECT * FROM expected_income WHERE id=? AND user_id=? AND status='expected'`).bind(String(b.expectedIncomeId||''),user.id).first(),occurred=validDate(b.date);
  if(!item||!occurred)return reply({error:'expected_income_not_available'},409);const actual=b.amount==null||b.amount===''?Number(item.amount_minor):moneyMinor(b.amount);if(actual<=0)return reply({error:'invalid_income'},400);const income=await createAllocatedIncome(env,user,{amount:actual,occurred,description:item.name,source:item.source,key:idempotency(request)}),now=new Date().toISOString();
  if(income.error)return reply(income,income.status||400);await env.DB.prepare(`UPDATE expected_income SET status='received',received_ledger_id=?,updated_at=? WHERE id=? AND user_id=? AND status='expected'`).bind(income.id,now,item.id,user.id).run();return reply({...income,expectedIncomeId:item.id},201);
}

async function recordIncome(request,env,user){
  const b=await readJson(request), amount=moneyMinor(b.amount), occurred=validDate(b.date), description=clean(b.description,160), source=clean(b.source,80);
  if(amount<=0||!occurred||!description)return reply({error:'invalid_income'},400);
  const result=await createAllocatedIncome(env,user,{amount,occurred,description,source,key:idempotency(request)});return result.error?reply(result,result.status||400):reply(result,201);
}

async function createAllocatedIncome(env,user,{amount,occurred,description,source,key}){
  const rule=await latestAllocation(env,user,occurred);
  if(!rule)return {error:'allocation_rule_required',status:409};
  const incomeId=crypto.randomUUID(),now=new Date().toISOString();
  const parts=allocateMinor(amount,rule),entries=[
    env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,description,metadata_json,created_at,idempotency_key)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(incomeId,user.id,occurred,'income','income',amount,description,JSON.stringify({source}),now,key)
  ];
  Object.entries(parts).forEach(([category,value])=>entries.push(env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,source_entry_id,description,metadata_json,created_at,idempotency_key)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,occurred,'allocation',category,value,incomeId,`Allocation from ${description}`,JSON.stringify({percentage:rule[`${category}_percentage`]}),now,`${key}:${category}`)));
  await env.DB.batch(entries); return {id:incomeId,amountMinor:amount,allocation:parts};
}

async function directFunds(request,env,user){
  const b=await readJson(request),category=validCategory(b.category),amount=moneyMinor(b.amount),occurred=validDate(b.date);
  if(!category||amount<=0||!occurred)return reply({error:'invalid_direct_funds'},400);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,description,metadata_json,created_at,idempotency_key)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,user.id,occurred,'direct_funds',category,amount,clean(b.note,300),JSON.stringify({source:clean(b.source,80),autoAllocated:false}),now,idempotency(request)).run();
  return reply({id,amountMinor:amount,category},201);
}

async function transferFunds(request,env,user){
  const b=await readJson(request),from=validCategory(b.from),to=validCategory(b.to),amount=moneyMinor(b.amount),occurred=validDate(b.date),key=idempotency(request);
  if(!from||!to||from===to||amount<=0||!occurred)return reply({error:'invalid_transfer'},400);
  const balance=await categoryBalance(env,user,from); if(balance<amount)return reply({error:'insufficient_category_funds',availableMinor:balance},409);
  const transferId=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.batch([
    ledger(env,{id:crypto.randomUUID(),user,occurred,type:'transfer_out',category:from,amount:-amount,relatedType:'transfer',relatedId:transferId,description:`Transfer to ${to}`,key:`${key}:out`,now}),
    ledger(env,{id:crypto.randomUUID(),user,occurred,type:'transfer_in',category:to,amount,relatedType:'transfer',relatedId:transferId,description:`Transfer from ${from}`,key:`${key}:in`,now})
  ]); return reply({id:transferId,from,to,amountMinor:amount},201);
}

async function saveAllocationRule(request,env,user){
  const b=await readJson(request),effective=validDate(b.effectiveFrom),values={living:Number(b.living),debt:Number(b.debt),savings:Number(b.savings),fun:Number(b.fun)};
  if(!effective||Object.values(values).some(v=>!Number.isFinite(v)||v<0||v>100)||Math.abs(Object.values(values).reduce((a,v)=>a+v,0)-100)>.001)return reply({error:'allocations_must_total_100'},400);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO allocation_rules(id,user_id,effective_from,living_percentage,debt_percentage,savings_percentage,fun_percentage,created_at) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(id,user.id,effective,values.living,values.debt,values.savings,values.fun,now).run();
  return reply({id,effectiveFrom:effective,...values},201);
}

async function listGoals(request,env,user){
  const category=new URL(request.url).searchParams.get('category');
  if(category&&!['savings','fun'].includes(category))return reply({error:'invalid_category'},400);
  const sql=`SELECT g.*,COALESCE(SUM(CASE WHEN l.entry_type='goal_allocation' THEN l.amount_minor WHEN l.entry_type='goal_use' THEN l.amount_minor ELSE 0 END),0) saved_minor FROM goals g LEFT JOIN ledger_entries l ON l.related_type='goal' AND l.related_id=g.id WHERE g.user_id=? ${category?'AND g.category=?':''} GROUP BY g.id ORDER BY g.status,g.created_at DESC`;
  const rows=category?await env.DB.prepare(sql).bind(user.id,category).all():await env.DB.prepare(sql).bind(user.id).all();
  return reply({items:rows.results});
}

async function saveGoal(request,env,user){
  const b=await readJson(request),category=['savings','fun'].includes(b.category)?b.category:null,type=['target','sinking','continuous'].includes(b.goalType)?b.goalType:null,name=clean(b.name,120),target=b.targetAmount===''||b.targetAmount==null?null:moneyMinor(b.targetAmount),now=new Date().toISOString();
  if(!category||!type||!name||(type!=='continuous'&&!(target>0)))return reply({error:'invalid_goal'},400);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO goals(id,user_id,category,name,goal_type,target_amount_minor,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,user.id,category,name,type,type==='continuous'?null:target,'active',now,now).run();
  return reply({id,category,name,goalType:type,targetAmountMinor:type==='continuous'?null:target},201);
}

async function allocateGoalFunds(request,env,user){
  const b=await readJson(request),amount=moneyMinor(b.amount),occurred=validDate(b.date),goal=await ownedGoal(env,user,b.goalId);
  if(!goal||amount<=0||!occurred)return reply({error:'invalid_goal_allocation'},400);
  const available=await categoryBalance(env,user,goal.category);if(available<amount)return reply({error:'insufficient_available_funds',availableMinor:available},409);
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,related_type,related_id,description,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),user.id,occurred,'goal_allocation',goal.category,-amount,'goal',goal.id,`Allocated to ${goal.name}`,now,idempotency(request)).run();
  return reply({goalId:goal.id,amountMinor:amount},201);
}

async function useGoalFunds(request,env,user){
  const b=await readJson(request),amount=moneyMinor(b.amount),occurred=validDate(b.date),goal=await ownedGoal(env,user,b.goalId);
  if(!goal||amount<=0||!occurred)return reply({error:'invalid_goal_use'},400);
  const saved=await goalBalance(env,user,goal.id);if(saved<amount)return reply({error:'insufficient_goal_funds',availableMinor:saved},409);
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,related_type,related_id,description,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),user.id,occurred,'goal_use',goal.category,amount,'goal',goal.id,clean(b.note,300)||`Used funds from ${goal.name}`,now,idempotency(request)).run();
  return reply({goalId:goal.id,amountMinor:amount},201);
}

async function ownedGoal(env,user,id){return env.DB.prepare(`SELECT * FROM goals WHERE id=? AND user_id=? AND status='active'`).bind(String(id||''),user.id).first();}
async function goalBalance(env,user,id){const row=await env.DB.prepare(`SELECT COALESCE(-SUM(amount_minor),0) balance FROM ledger_entries WHERE user_id=? AND related_type='goal' AND related_id=? AND entry_type IN ('goal_allocation','goal_use')`).bind(user.id,id).first();return Number(row.balance||0);}

async function listLivingPlans(env,user){return reply({items:(await env.DB.prepare(`SELECT p.*,b.id bill_instance_id,b.billing_month,b.due_on,b.actual_amount_minor,b.paid_amount_minor,b.status bill_status FROM living_plans p LEFT JOIN living_bill_instances b ON b.id=(SELECT id FROM living_bill_instances WHERE plan_id=p.id ORDER BY billing_month DESC LIMIT 1) WHERE p.user_id=? AND p.active=1 ORDER BY p.plan_type,p.name`).bind(user.id).all()).results});}
async function saveLivingPlan(request,env,user){
  const b=await readJson(request),name=clean(b.name,120),type=['bill','budget'].includes(b.planType)?b.planType:null,amount=moneyMinor(b.plannedAmount),due=b.dueDay==null||b.dueDay===''?null:Number(b.dueDay),now=new Date().toISOString();
  if(!name||!type||amount<0||(type==='bill'&&(!Number.isInteger(due)||due<1||due>31)))return reply({error:'invalid_living_plan'},400);const id=String(b.id||crypto.randomUUID());
  await env.DB.prepare(`INSERT INTO living_plans(id,user_id,name,plan_type,planned_amount_minor,due_day,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?) ON CONFLICT(user_id,name) DO UPDATE SET plan_type=excluded.plan_type,planned_amount_minor=excluded.planned_amount_minor,due_day=excluded.due_day,active=1,updated_at=excluded.updated_at`).bind(id,user.id,name,type,amount,type==='bill'?due:null,now,now).run();const saved=await env.DB.prepare(`SELECT id FROM living_plans WHERE user_id=? AND lower(name)=lower(?)`).bind(user.id,name).first();return reply({id:saved.id,name,planType:type,plannedAmountMinor:amount,dueDay:type==='bill'?due:null},201);
}
async function saveLivingBill(request,env,user){
  const b=await readJson(request),plan=await env.DB.prepare(`SELECT * FROM living_plans WHERE id=? AND user_id=? AND plan_type='bill' AND active=1`).bind(String(b.planId||''),user.id).first(),month=/^\d{4}-\d{2}$/.test(String(b.billingMonth||''))?String(b.billingMonth):null,actual=moneyMinor(b.actualAmount),due=validDate(b.dueOn),now=new Date().toISOString();if(!plan||!month||actual<0||!due||!due.startsWith(month))return reply({error:'invalid_living_bill'},400);const id=crypto.randomUUID();
  const existing=await env.DB.prepare(`SELECT paid_amount_minor FROM living_bill_instances WHERE plan_id=? AND billing_month=?`).bind(plan.id,month).first();if(existing&&actual<Number(existing.paid_amount_minor))return reply({error:'actual_bill_below_amount_already_paid',paidMinor:existing.paid_amount_minor},409);
  await env.DB.prepare(`INSERT INTO living_bill_instances(id,user_id,plan_id,billing_month,due_on,actual_amount_minor,paid_amount_minor,status,created_at,updated_at) VALUES(?,?,?,?,?,?,0,'unpaid',?,?) ON CONFLICT(plan_id,billing_month) DO UPDATE SET due_on=excluded.due_on,actual_amount_minor=excluded.actual_amount_minor,status=CASE WHEN paid_amount_minor>=excluded.actual_amount_minor THEN 'paid' WHEN paid_amount_minor>0 THEN 'partially_paid' ELSE 'unpaid' END,updated_at=excluded.updated_at`).bind(id,user.id,plan.id,month,due,actual,now,now).run();const saved=await env.DB.prepare(`SELECT * FROM living_bill_instances WHERE plan_id=? AND billing_month=?`).bind(plan.id,month).first();return reply(saved,201);
}
async function recordExpense(request,env,user){
  const b=await readJson(request),category=validCategory(b.category),amount=moneyMinor(b.amount),occurred=validDate(b.date),description=clean(b.description,160),planId=clean(b.planId,80);
  if(!category||amount<=0||!occurred||!description)return reply({error:'invalid_expense'},400);const available=await categoryBalance(env,user,category);if(available<amount)return reply({error:'insufficient_category_funds',availableMinor:available},409);
  if(planId){const plan=await env.DB.prepare(`SELECT id FROM living_plans WHERE id=? AND user_id=? AND active=1`).bind(planId,user.id).first();if(!plan)return reply({error:'living_plan_not_found'},404);}
  const id=crypto.randomUUID(),now=new Date().toISOString(),type=b.expenseType==='bill'?'bill_payment':'expense';
  const entry=env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,related_type,related_id,description,metadata_json,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.id,occurred,type,category,-amount,planId?'living_plan':null,planId||null,description,JSON.stringify({unlisted:!planId}),now,idempotency(request));
  if(type==='bill_payment'){
    const bill=await env.DB.prepare(`SELECT * FROM living_bill_instances WHERE plan_id=? AND user_id=? AND status!='paid' ORDER BY billing_month DESC LIMIT 1`).bind(planId,user.id).first();if(!bill)return reply({error:'no_unpaid_bill'},409);const outstanding=Number(bill.actual_amount_minor)-Number(bill.paid_amount_minor);if(amount>outstanding)return reply({error:'excess_bill_payment_not_allowed',outstandingMinor:outstanding},409);const paid=Number(bill.paid_amount_minor)+amount;
    try{await env.DB.batch([entry,env.DB.prepare(`INSERT INTO living_bill_payment_operations(id,bill_instance_id,expected_paid_minor,payment_amount_minor,ledger_entry_id,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),bill.id,bill.paid_amount_minor,amount,id,now),env.DB.prepare(`UPDATE living_bill_instances SET paid_amount_minor=?,status=?,updated_at=? WHERE id=? AND user_id=? AND paid_amount_minor=?`).bind(paid,paid===Number(bill.actual_amount_minor)?'paid':'partially_paid',now,bill.id,user.id,bill.paid_amount_minor)]);}catch(error){if(/UNIQUE|constraint/i.test(String(error.message)))return reply({error:'bill_changed_refresh_and_retry'},409);throw error;}
  }else await entry.run();return reply({id,amountMinor:amount,category},201);
}

async function listDebts(env,user){
  const result=await env.DB.prepare(`SELECT d.*,c.name creditor_name,(SELECT json_object('effectiveOn',v.effective_on,'paymentAmountMinor',v.payment_amount_minor,'dueDate',v.due_date,'interestMode',v.interest_mode,'interestValue',v.interest_value,'interestFrequency',v.interest_frequency,'paymentPaused',v.payment_paused) FROM debt_agreement_versions v WHERE v.debt_id=d.id ORDER BY v.effective_on DESC,v.created_at DESC LIMIT 1) agreement FROM debts d JOIN creditors c ON c.id=d.creditor_id WHERE d.user_id=? AND d.status!='archived' ORDER BY CASE d.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'paid' THEN 2 ELSE 3 END,c.name`).bind(user.id).all();
  return reply({items:result.results.map(x=>({...x,agreement:x.agreement?JSON.parse(x.agreement):null}))});
}

async function debtHistory(id,env,user){
  const debt=await env.DB.prepare(`SELECT d.*,c.name creditor_name FROM debts d JOIN creditors c ON c.id=d.creditor_id WHERE d.id=? AND d.user_id=?`).bind(id,user.id).first();if(!debt)return reply({error:'debt_not_found'},404);
  const [agreements,activity,interest]=await Promise.all([env.DB.prepare(`SELECT * FROM debt_agreement_versions WHERE debt_id=? ORDER BY effective_on DESC,created_at DESC`).bind(id).all(),env.DB.prepare(`SELECT * FROM ledger_entries WHERE user_id=? AND related_type='debt' AND related_id=? ORDER BY occurred_on DESC,created_at DESC`).bind(user.id,id).all(),env.DB.prepare(`SELECT cycle_on,amount_minor,agreement_version_id FROM scheduled_interest_charges WHERE user_id=? AND debt_id=? ORDER BY cycle_on DESC`).bind(user.id,id).all()]);
  return reply({debt,agreements:agreements.results,activity:activity.results,interest:interest.results});
}

async function createDebt(request,env,user){
  const b=await readJson(request),balance=moneyMinor(b.currentBalance),payment=moneyMinor(b.paymentAmount),due=validDate(b.dueDate),creditor=clean(b.creditor,120),mode=interestMode(b.interestMode),frequency=interestFrequency(b.interestFrequency),now=new Date().toISOString();
  if(!creditor||balance<=0||payment<0||!due||!mode||!frequency)return reply({error:'invalid_debt'},400);
  let c=await env.DB.prepare('SELECT id FROM creditors WHERE user_id=? AND lower(name)=lower(?)').bind(user.id,creditor).first();
  const creditorId=c?.id||crypto.randomUUID(),debtId=crypto.randomUUID();
  const statements=[];
  if(!c)statements.push(env.DB.prepare('INSERT INTO creditors(id,user_id,name,active,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(creditorId,user.id,creditor,1,now,now));
  else statements.push(env.DB.prepare('UPDATE creditors SET active=1,updated_at=? WHERE id=? AND user_id=?').bind(now,creditorId,user.id));
  statements.push(env.DB.prepare(`INSERT INTO debts(id,user_id,creditor_id,journey_start_balance_minor,current_balance_minor,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(debtId,user.id,creditorId,balance,balance,b.paused?'paused':'active',now,now));
  statements.push(env.DB.prepare(`INSERT INTO debt_agreement_versions(id,debt_id,effective_on,payment_amount_minor,due_date,payment_frequency,interest_mode,interest_value,interest_frequency,interest_basis,payment_paused,change_reason,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),debtId,due,payment,due,clean(b.paymentFrequency,20)||'monthly',mode,Number(b.interestValue||0),frequency,clean(b.interestBasis,20)||'remaining',b.paused?1:0,'created',clean(b.notes,1000),now));
  statements.push(env.DB.prepare(`UPDATE recovery_journeys SET no_new_debt_since=?,updated_at=? WHERE user_id=?`).bind(dateOnly(new Date()),now,user.id));
  statements.push(ledger(env,{id:crypto.randomUUID(),user,occurred:dateOnly(new Date()),type:'new_debt',category:'debt_adjustment',amount:balance,relatedType:'debt',relatedId:debtId,description:`New debt · ${creditor}`,key:idempotency(request),now}));
  await env.DB.batch(statements); return reply({id:debtId,currentBalanceMinor:balance},201);
}

async function debtPayment(request,env,user){
  const b=await readJson(request),amount=moneyMinor(b.amount),occurred=validDate(b.date),debt=await env.DB.prepare(`SELECT d.*,c.name creditor_name FROM debts d JOIN creditors c ON c.id=d.creditor_id WHERE d.id=? AND d.user_id=? AND d.status IN ('active','paused')`).bind(String(b.debtId||''),user.id).first();
  if(!debt||amount<=0||!occurred)return reply({error:'invalid_debt_payment'},400);
  if(amount>debt.current_balance_minor)return reply({error:'excess_payment_not_allowed',currentBalanceMinor:debt.current_balance_minor},409);
  const available=await categoryBalance(env,user,'debt'); if(amount>available)return reply({error:'insufficient_debt_funds',availableMinor:available},409);
  const next=debt.current_balance_minor-amount,now=new Date().toISOString(),status=next===0?'paid':debt.status,ledgerId=crypto.randomUUID();
  try{await env.DB.batch([
    ledger(env,{id:ledgerId,user,occurred,type:'debt_payment',category:'debt',amount:-amount,relatedType:'debt',relatedId:debt.id,description:`Payment · ${debt.creditor_name}`,key:idempotency(request),now}),
    env.DB.prepare(`INSERT INTO debt_payment_operations(id,debt_id,expected_balance_minor,payment_amount_minor,ledger_entry_id,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),debt.id,debt.current_balance_minor,amount,ledgerId,now),
    env.DB.prepare('UPDATE debts SET current_balance_minor=?,status=?,paid_at=?,updated_at=? WHERE id=? AND user_id=? AND current_balance_minor=?').bind(next,status,next===0?occurred:null,now,debt.id,user.id,debt.current_balance_minor),
  ]);}catch(error){if(/UNIQUE|constraint/i.test(String(error.message)))return reply({error:'debt_changed_refresh_and_retry'},409);throw error;}
  return reply({debtId:debt.id,currentBalanceMinor:next,status},201);
}

async function updateDebtAgreement(request,env,user){
  const b=await readJson(request),debt=await env.DB.prepare(`SELECT d.*,c.name creditor_name FROM debts d JOIN creditors c ON c.id=d.creditor_id WHERE d.id=? AND d.user_id=? AND d.status IN ('active','paused')`).bind(String(b.debtId||''),user.id).first(),reason=['agreement','negotiated','correction'].includes(b.reason)?b.reason:null,effective=validDate(b.effectiveOn),newBalance=b.currentBalance===''||b.currentBalance==null?null:moneyMinor(b.currentBalance),payment=moneyMinor(b.paymentAmount),due=validDate(b.dueDate),mode=interestMode(b.interestMode),frequency=interestFrequency(b.interestFrequency);
  if(!debt||!reason||!effective||payment<0||!due||!mode||!frequency||(newBalance!==null&&newBalance<0))return reply({error:'invalid_agreement_update'},400);
  if(reason!=='agreement'&&newBalance===null)return reply({error:'updated_balance_required'},400);
  const now=new Date().toISOString(),versionId=crypto.randomUUID(),paused=Boolean(b.paused),statements=[
    env.DB.prepare(`INSERT INTO debt_agreement_versions(id,debt_id,effective_on,payment_amount_minor,due_date,payment_frequency,interest_mode,interest_value,interest_frequency,interest_basis,payment_paused,change_reason,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(versionId,debt.id,effective,payment,due,clean(b.paymentFrequency,20)||'monthly',mode,Number(b.interestValue||0),frequency,clean(b.interestBasis,20)||'remaining',paused?1:0,reason,clean(b.notes,1000),now)
  ];
  if(newBalance!==null){
    const delta=newBalance-Number(debt.current_balance_minor);
    statements.push(env.DB.prepare(`UPDATE debts SET current_balance_minor=?,status=?,updated_at=? WHERE id=? AND user_id=?`).bind(newBalance,newBalance===0?'paid':(paused?'paused':'active'),now,debt.id,user.id));
    if(delta)statements.push(ledger(env,{id:crypto.randomUUID(),user,occurred:effective,type:reason==='negotiated'?'negotiated_reduction':'balance_correction',category:'debt_adjustment',amount:delta,relatedType:'debt',relatedId:debt.id,description:`${reason==='negotiated'?'Negotiated balance':'Balance correction'} · ${debt.creditor_name}`,key:idempotency(request),now}));
  }else statements.push(env.DB.prepare(`UPDATE debts SET status=?,updated_at=? WHERE id=? AND user_id=?`).bind(paused?'paused':'active',now,debt.id,user.id));
  await env.DB.batch(statements);
  return reply({debtId:debt.id,agreementVersionId:versionId,currentBalanceMinor:newBalance??debt.current_balance_minor,status:newBalance===0?'paid':(paused?'paused':'active')},201);
}

async function archiveDebt(request,env,user){
  const b=await readJson(request),debt=await env.DB.prepare(`SELECT id,current_balance_minor,status FROM debts WHERE id=? AND user_id=?`).bind(String(b.debtId||''),user.id).first();
  if(!debt)return reply({error:'debt_not_found'},404);
  if(debt.status!=='paid'||Number(debt.current_balance_minor)!==0)return reply({error:'only_fully_paid_debt_can_be_archived'},409);
  const now=new Date().toISOString();
  await env.DB.prepare(`UPDATE debts SET status='archived',archived_at=?,updated_at=? WHERE id=? AND user_id=? AND current_balance_minor=0`).bind(now,now,debt.id,user.id).run();
  return reply({debtId:debt.id,status:'archived'});
}

async function recoverySummary(env,user){
  const [journey,balance,snapshots,cleared,changes]=await Promise.all([
    env.DB.prepare(`SELECT * FROM recovery_journeys WHERE user_id=?`).bind(user.id).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(current_balance_minor),0) total FROM debts WHERE user_id=? AND status IN ('active','paused','paid')`).bind(user.id).first(),
    env.DB.prepare(`SELECT snapshot_on,balance_minor FROM recovery_snapshots WHERE user_id=? ORDER BY snapshot_on`).bind(user.id).all(),
    env.DB.prepare(`SELECT d.id,c.name creditor_name,d.journey_start_balance_minor,d.paid_at FROM debts d JOIN creditors c ON c.id=d.creditor_id WHERE d.user_id=? AND d.status IN ('paid','archived') ORDER BY d.paid_at DESC LIMIT 20`).bind(user.id).all(),
    env.DB.prepare(`SELECT entry_type,COALESCE(SUM(amount_minor),0) amount_minor FROM ledger_entries WHERE user_id=? AND entry_type IN ('debt_payment','negotiated_reduction','balance_correction','interest','new_debt') AND occurred_on>=COALESCE((SELECT started_on FROM recovery_journeys WHERE user_id=?),'0000-01-01') GROUP BY entry_type`).bind(user.id,user.id).all()
  ]);
  const current=Number(balance.total||0),starting=Number(journey?.starting_debt_minor??current),corrections=Number(changes.results.find(x=>x.entry_type==='balance_correction')?.amount_minor||0),progress=calculateRecovery(starting,current,Number(journey?.target_balance_minor||0),corrections);
  const amount=type=>Number(changes.results.find(x=>x.entry_type===type)?.amount_minor||0),breakdown={paymentsMinor:amount('debt_payment'),negotiatedMinor:amount('negotiated_reduction'),correctionsMinor:amount('balance_correction'),interestMinor:amount('interest'),newDebtMinor:amount('new_debt')};
  return reply({journey:journey||null,startingDebtMinor:starting,currentDebtMinor:current,correctionAdjustmentMinor:corrections,...progress,breakdown,snapshots:snapshots.results,debtsCleared:cleared.results,noNewDebtDays:journey?daysBetween(journey.no_new_debt_since,dateOnly(new Date())):0});
}

async function saveRecoveryGoal(request,env,user){
  const b=await readJson(request),target=moneyMinor(b.targetBalance||0),targetDate=b.targetDate?validDate(b.targetDate):null,now=new Date().toISOString(),balance=await env.DB.prepare(`SELECT COALESCE(SUM(current_balance_minor),0) total FROM debts WHERE user_id=? AND status IN ('active','paused','paid')`).bind(user.id).first(),existing=await env.DB.prepare(`SELECT user_id FROM recovery_journeys WHERE user_id=?`).bind(user.id).first();
  if(target<0||(b.targetDate&&!targetDate))return reply({error:'invalid_recovery_goal'},400);
  if(existing)await env.DB.prepare(`UPDATE recovery_journeys SET target_balance_minor=?,target_date=?,updated_at=? WHERE user_id=?`).bind(target,targetDate,now,user.id).run();
  else await env.DB.prepare(`INSERT INTO recovery_journeys(user_id,started_on,starting_debt_minor,target_balance_minor,target_date,no_new_debt_since,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(user.id,dateOnly(new Date()),Number(balance.total||0),target,targetDate,dateOnly(new Date()),now,now).run();
  return reply({targetBalanceMinor:target,targetDate});
}

async function exportAccount(env,user){
  const tables=['allocation_rules','ledger_entries','expected_income','living_plans','goals','creditors','debts','recovery_journeys','recovery_snapshots'];
  const data={exportedAt:new Date().toISOString(),profile:safeUser(user)};
  for(const table of tables)data[table]=(await env.DB.prepare(`SELECT * FROM ${table} WHERE user_id=?`).bind(user.id).all()).results;
  const debtIds=data.debts.map(x=>x.id);
  data.debt_agreement_versions=[];
  for(const id of debtIds)data.debt_agreement_versions.push(...(await env.DB.prepare(`SELECT * FROM debt_agreement_versions WHERE debt_id=? ORDER BY effective_on`).bind(id).all()).results);
  return reply(data,200,{'headers':{'content-disposition':`attachment; filename="drs-export-${dateOnly(new Date())}.json"`}});
}

async function requestAccountDeletion(request,env,user){
  const b=await readJson(request);if(String(b.confirmation||'')!=='DELETE')return reply({error:'deletion_confirmation_required'},400);
  const now=new Date().toISOString(),jobId=crypto.randomUUID(),anonymous=`deleted-${user.id}@invalid.local`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO account_deletion_jobs(id,user_id,requested_at,confirmed_at,execute_after,status) VALUES(?,?,?,?,?,'confirmed') ON CONFLICT(user_id) DO UPDATE SET confirmed_at=excluded.confirmed_at,execute_after=excluded.execute_after,status='confirmed'`).bind(jobId,user.id,now,now,now),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM notification_queue WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM allocation_rules WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM expected_income WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM living_plans WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM goals WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM recovery_snapshots WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM recovery_journeys WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM debts WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM creditors WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM ledger_entries WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`UPDATE users SET google_sub=?,email=?,name='',status='deleted',updated_at=?,last_active_at=NULL WHERE id=?`).bind(`deleted:${crypto.randomUUID()}`,anonymous,now,user.id),
    env.DB.prepare(`UPDATE account_deletion_jobs SET status='completed',completed_at=? WHERE user_id=?`).bind(now,user.id)
  ]);
  return reply({status:'deleted',backupNotice:'Temporary backup copies may remain until backup expiry, normally within 30 days.'});
}

async function paymentWebhook(request,env){
  const mode=String(env.PAYMENT_PROVIDER_MODE||'disabled'),raw=await request.text(),payload=safeJson(raw);
  let normalized=null;
  if(mode==='payhip'){
    if(!await verifyPayhipWebhook(payload,env.PAYHIP_API_KEY))return reply({error:'invalid_webhook_signature'},401);
    normalized=normalizePayhipEvent(payload,parseProductMap(env.PAYHIP_PRODUCT_MAP));
  }else if(mode==='paypal'){
    if(!await verifyPayPalWebhook(request,payload,env))return reply({error:'invalid_webhook_signature'},401);
    normalized=normalizePayPalEvent(payload,parseProductMap(env.PAYPAL_PRODUCT_MAP));
  }else if(mode==='payhip_paypal'){
    if(payload.signature){
      if(!await verifyPayhipWebhook(payload,env.PAYHIP_API_KEY))return reply({error:'invalid_webhook_signature'},401);
      normalized=normalizePayhipEvent(payload,parseProductMap(env.PAYHIP_PRODUCT_MAP));
    }else{
      if(!await verifyPayPalWebhook(request,payload,env))return reply({error:'invalid_webhook_signature'},401);
      normalized=normalizePayPalEvent(payload,parseProductMap(env.PAYPAL_PRODUCT_MAP));
    }
  }else if(mode==='normalized_gateway'){
    const supplied=String(request.headers.get('x-drs-webhook-secret')||''),secret=String(env.PAYMENT_WEBHOOK_SECRET||'');
    if(secret.length<32||!constantEqual(supplied,secret))return reply({error:'invalid_webhook_signature'},401);
    normalized=normalizePaymentEvent(payload);
  }else return reply({error:'payment_provider_not_configured'},503);
  if(!normalized)return reply({error:'invalid_payment_event'},400);
  const existing=await env.DB.prepare(`SELECT id,status FROM payment_events WHERE provider=? AND provider_event_id=?`).bind(normalized.provider,normalized.eventId).first();
  if(existing)return reply({accepted:true,duplicate:true,status:existing.status});
  const id=crypto.randomUUID(),now=new Date().toISOString(),hash=await sha256(raw),licenseKey=normalized.licenseKey,stored={...normalized,licenseKey:'',hasLicenseKey:Boolean(licenseKey)};
  await env.DB.prepare(`INSERT INTO payment_events(id,provider,provider_event_id,provider_transaction_id,user_email,event_type,status,amount_minor,currency,payload_hash,received_at,normalized_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,normalized.provider,normalized.eventId,normalized.transactionId,normalized.email,normalized.type,'received',normalized.amountMinor,normalized.currency,hash,now,JSON.stringify(stored)).run();
  if(normalized.type==='payment_completed'&&licenseKey&&['3months','6months','12months'].includes(normalized.plan))await env.DB.prepare(`INSERT OR IGNORE INTO license_keys(id,key_hash,provider,provider_transaction_id,purchaser_email,plan,status,created_at) VALUES(?,?,?,?,?,?,'available',?)`).bind(crypto.randomUUID(),await sha256(licenseKey),normalized.provider,normalized.transactionId,normalized.email,normalized.plan,now).run();
  const outcome=await processPaymentEvent(env,id);
  return reply({accepted:true,eventId:id,status:outcome.status},202);
}

async function verifyPayhipWebhook(payload,apiKey){
  const key=String(apiKey||''),signature=String(payload?.signature||'');
  if(key.length<20||!signature)return false;
  return constantEqual(signature,await sha256(key));
}

async function verifyPayPalWebhook(request,payload,env){
  const required=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
  if(required.some(name=>!request.headers.get(name))||!env.PAYPAL_WEBHOOK_ID||!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)return false;
  const base=env.PAYPAL_ENVIRONMENT==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
  const tokenResponse=await fetch(`${base}/v1/oauth2/token`,{method:'POST',headers:{authorization:`Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!tokenResponse.ok)return false;const token=await tokenResponse.json();if(!token.access_token)return false;
  const verification=await fetch(`${base}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{authorization:`Bearer ${token.access_token}`,'content-type':'application/json'},body:JSON.stringify({auth_algo:request.headers.get('paypal-auth-algo'),cert_url:request.headers.get('paypal-cert-url'),transmission_id:request.headers.get('paypal-transmission-id'),transmission_sig:request.headers.get('paypal-transmission-sig'),transmission_time:request.headers.get('paypal-transmission-time'),webhook_id:env.PAYPAL_WEBHOOK_ID,webhook_event:payload})});
  if(!verification.ok)return false;const result=await verification.json();return result.verification_status==='SUCCESS';
}

function parseProductMap(value){const parsed=safeJson(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}
function mappedPlan(map,...keys){for(const key of keys){const plan=map[String(key||'')];if(['3months','6months','12months'].includes(plan))return plan;}return '';}
function normalizePayhipEvent(payload,map={}){
  const item=Array.isArray(payload?.items)?payload.items[0]||{}:{},rawType=String(payload?.type||''),type=rawType==='paid'?'payment_completed':rawType==='refunded'?'refund':null;
  if(!type)return null;const transactionId=clean(payload.id,160),plan=mappedPlan(map,item.product_id,item.product_key,item.product_permalink,item.product_name),timestamp=payload.date_refunded||payload.date||payload.date_created||'';
  return normalizePaymentEvent({provider:'payhip',type,eventId:`${rawType}:${transactionId}:${timestamp}`,transactionId,email:payload.email,plan,licenseKey:item.license_key||payload.license_key||'',amountMinor:Number(type==='refund'?payload.amount_refunded:payload.price),currency:payload.currency});
}
function normalizePayPalEvent(payload,map={}){
  const resource=payload?.resource||{},rawType=String(payload?.event_type||''),resolution=String(resource.dispute_outcome?.outcome_code||resource.dispute_outcome||'').toUpperCase();
  const type=rawType==='CUSTOMER.DISPUTE.RESOLVED'?(resolution.includes('SELLER')?'dispute_resolved_won':'dispute_resolved_lost'):({'PAYMENT.CAPTURE.COMPLETED':'payment_completed','PAYMENT.CAPTURE.REFUNDED':'refund','PAYMENT.CAPTURE.REVERSED':'reversal','CUSTOMER.DISPUTE.CREATED':'dispute_opened'})[rawType]||null;
  if(!type)return null;const amount=resource.amount||resource.dispute_amount||{},transactionId=clean(resource.disputed_transactions?.[0]?.seller_transaction_id||resource.id,160),productKey=resource.custom_id||resource.invoice_id||resource.supplementary_data?.related_ids?.order_id||'',plan=mappedPlan(map,productKey),email=resource.payer?.email_address||resource.payee?.email_address||resource.buyer?.email_address||resource.disputed_transactions?.[0]?.buyer?.email_address||'';
  return normalizePaymentEvent({provider:'paypal',type,eventId:payload.id,transactionId,email,plan,amount:Number(amount.value||0),currency:amount.currency_code||'PHP'});
}

async function processPaymentEvent(env,eventId,manualAdminId=null,claimUser=null){
  const event=await env.DB.prepare(`SELECT * FROM payment_events WHERE id=?`).bind(eventId).first();if(!event)return {status:'missing'};
  const n=safeJson(event.normalized_json),now=new Date().toISOString();
  if(['refund','reversal','dispute_opened','dispute_resolved_won','dispute_resolved_lost'].includes(n.type))return applyEntitlementReversal(env,event,n,manualAdminId);
  if(n.type!=='payment_completed')return finishPaymentEvent(env,event,'ignored',null);
  const already=await env.DB.prepare(`SELECT id,status FROM entitlements WHERE source=? AND source_transaction_id=?`).bind(n.provider,n.transactionId).first();
  if(already){await recordActivationAttempt(env,event,'duplicate_prevented',null,manualAdminId);return finishPaymentEvent(env,event,already.status,null);}
  const user=claimUser||await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=? AND status='active'`).bind(normalizeEmail(n.email)).first(),license=await env.DB.prepare(`SELECT id FROM license_keys WHERE provider=? AND provider_transaction_id=? AND status='available'`).bind(n.provider,n.transactionId).first();
  if(!user&&license){await queueRecipientEmail(env,n.email,'purchase_ready_claim',{transactionId:n.transactionId},'critical',now);return finishPaymentEvent(env,event,'awaiting_claim',null);}
  if(!user)return activationFailure(env,event,'user_not_registered','Payment received; access will activate after this Google account signs in.');
  if(!['3months','6months','12months'].includes(n.plan))return activationFailure(env,event,'unknown_product','Verified payment has no approved plan mapping.');
  try{
    const today=dateOnly(new Date()),latest=await env.DB.prepare(`SELECT MAX(ends_on) ends_on FROM entitlements WHERE user_id=? AND status='active' AND ends_on>=?`).bind(user.id,today).first(),starts=latest?.ends_on?addDays(latest.ends_on,1):today,ends=addMonths(starts,Number(n.plan.replace('months',''))),entitlementId=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO entitlements(id,user_id,source,source_transaction_id,plan,starts_on,ends_on,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(entitlementId,user.id,n.provider,n.transactionId,n.plan,starts,ends,'active',now,now),
      env.DB.prepare(`UPDATE license_keys SET status='claimed',claimed_user_id=?,entitlement_id=?,claimed_at=? WHERE provider=? AND provider_transaction_id=? AND status='available'`).bind(user.id,entitlementId,now,n.provider,n.transactionId),
      env.DB.prepare(`UPDATE notification_queue SET status='cancelled' WHERE user_id=? AND template_key='data_deletion_warning' AND status='pending'`).bind(user.id),
      env.DB.prepare(`INSERT INTO admin_audit(id,admin_user_id,subject_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),manualAdminId,user.id,manualAdminId?'manual_activation':'automatic_activation','payment_event',event.id,'success',JSON.stringify({transactionId:n.transactionId,entitlementId}),now),
      queueEmail(env,user,'access_active',{plan:n.plan,endsOn:ends},'critical',now)
    ]);
    await recordActivationAttempt(env,event,manualAdminId?'manual_success':'success',null,manualAdminId);
    await finishPaymentEvent(env,event,'active',null);return {status:'active',entitlementId};
  }catch(error){return activationFailure(env,event,'entitlement_write_failed',clean(error.message,300));}
}

async function activationFailure(env,event,code,message){
  const attempt=Number(event.retry_count||0)+1,stopped=attempt>=3,now=new Date().toISOString(),next=stopped?null:new Date(Date.now()+attempt*15*60000).toISOString();
  await recordActivationAttempt(env,event,'failed',{code,message});
  await env.DB.prepare(`UPDATE payment_events SET status='activation_needs_attention',retry_count=?,next_retry_at=?,processing_error=? WHERE id=?`).bind(attempt,next,`${code}: ${message}`,event.id).run();
  if(attempt===1)await queueRecipientEmail(env,event.user_email,'payment_received_pending',{transactionId:event.provider_transaction_id},'critical',now);
  if(stopped)await queueAdminEmail(env,'activation_needs_attention',{eventId:event.id,email:event.user_email,transactionId:event.provider_transaction_id},'critical',now);
  return {status:'activation_needs_attention',retryScheduled:!stopped};
}

async function adminRecoverActivation(request,env,user){
  if(user.role!=='admin')return reply({error:'admin_required'},403);
  const b=await readJson(request),event=await env.DB.prepare(`SELECT * FROM payment_events WHERE id=? AND status='activation_needs_attention'`).bind(String(b.paymentEventId||'')).first();
  if(!event)return reply({error:'activation_event_not_found'},404);
  if(b.plan){if(!['3months','6months','12months'].includes(b.plan))return reply({error:'invalid_plan'},400);const normalized=safeJson(event.normalized_json);normalized.plan=b.plan;await env.DB.prepare(`UPDATE payment_events SET normalized_json=? WHERE id=?`).bind(JSON.stringify(normalized),event.id).run();}
  const result=await processPaymentEvent(env,event.id,user.id);return reply(result,result.status==='active'?200:409);
}

async function recoverUserPurchases(env,user){
  const events=await env.DB.prepare(`SELECT id FROM payment_events WHERE lower(user_email)=? AND status IN ('activation_needs_attention','awaiting_claim') ORDER BY received_at LIMIT 3`).bind(normalizeEmail(user.email)).all();
  for(const item of events.results)await processPaymentEvent(env,item.id);
}

async function claimLicense(env,user,rawKey){
  const license=await env.DB.prepare(`SELECT * FROM license_keys WHERE key_hash=? AND status='available'`).bind(await sha256(clean(rawKey,240))).first();if(!license)throw new Error('license_key_not_available');
  const event=await env.DB.prepare(`SELECT id FROM payment_events WHERE provider=? AND provider_transaction_id=?`).bind(license.provider,license.provider_transaction_id).first();if(!event)throw new Error('license_transaction_missing');
  return processPaymentEvent(env,event.id,null,user);
}

async function adminEntitlements(request,env,user){
  if(user.role!=='admin')return reply({error:'admin_required'},403);
  const url=new URL(request.url),search=`%${String(url.searchParams.get('q')||'').toLowerCase()}%`;
  const [rows,grants]=await Promise.all([env.DB.prepare(`SELECT e.*,u.email,u.name FROM entitlements e JOIN users u ON u.id=e.user_id WHERE lower(u.email) LIKE ? ORDER BY e.updated_at DESC LIMIT 100`).bind(search).all(),env.DB.prepare(`SELECT id,email,'' name,'external_admin' source,plan,starts_on,ends_on,'pending_first_sign_in' status,created_at updated_at FROM admin_access_grants WHERE status='pending' AND lower(email) LIKE ? ORDER BY created_at DESC LIMIT 100`).bind(search).all()]);
  return reply({items:rows.results.concat(grants.results).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,100)});
}

async function adminSaveEntitlement(request,env,user){
  if(user.role!=='admin')return reply({error:'admin_required'},403);
  const b=await readJson(request),target=await env.DB.prepare('SELECT id,email FROM users WHERE lower(email)=?').bind(normalizeEmail(b.email)).first(),plan=String(b.plan||''),start=validDate(b.startsOn),end=validDate(b.endsOn);
  if(!normalizeEmail(b.email).includes('@')||!['3months','6months','12months','test'].includes(plan)||!start||!end||end<start)return reply({error:'invalid_entitlement'},400);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  if(!target){const reference=clean(b.reference,160)||id;await env.DB.batch([env.DB.prepare(`INSERT INTO admin_access_grants(id,email,plan,starts_on,ends_on,reference,status,created_by,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)`).bind(id,normalizeEmail(b.email),plan,start,end,reference,user.id,now),env.DB.prepare(`INSERT INTO admin_audit(id,admin_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,'pending_access_grant_created','admin_access_grant',id,'success',JSON.stringify({email:normalizeEmail(b.email),plan,start,end,reference}),now)]);return reply({id,status:'pending_first_sign_in'},201);}
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO entitlements(id,user_id,source,source_transaction_id,plan,starts_on,ends_on,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,target.id,'external_admin',String(b.reference||id),plan,start,end,'active',now,now),
    env.DB.prepare(`UPDATE notification_queue SET status='cancelled' WHERE user_id=? AND template_key='data_deletion_warning' AND status='pending'`).bind(target.id),
    env.DB.prepare(`INSERT INTO admin_audit(id,admin_user_id,subject_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,target.id,'entitlement_created','entitlement',id,'success',JSON.stringify({plan,start,end,source:'external_admin'}),now)
  ]); return reply({id,status:'active'},201);
}

async function claimAdminGrants(env,user){
  const rows=await env.DB.prepare(`SELECT * FROM admin_access_grants WHERE lower(email)=? AND status='pending' ORDER BY created_at LIMIT 5`).bind(normalizeEmail(user.email)).all();
  for(const grant of rows.results){const entitlementId=crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare(`INSERT INTO entitlements(id,user_id,source,source_transaction_id,plan,starts_on,ends_on,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(entitlementId,user.id,'external_admin',grant.reference,grant.plan,grant.starts_on,grant.ends_on,'active',now,now),env.DB.prepare(`UPDATE admin_access_grants SET status='claimed',claimed_user_id=?,entitlement_id=?,claimed_at=? WHERE id=? AND status='pending'`).bind(user.id,entitlementId,now,grant.id),env.DB.prepare(`INSERT INTO admin_audit(id,subject_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,'pending_access_grant_claimed','entitlement',entitlementId,'success',JSON.stringify({grantId:grant.id}),now),queueEmail(env,user,'access_active',{plan:grant.plan,endsOn:grant.ends_on},'critical',now)]);}
}

async function adminSetEntitlementStatus(request,env,user){
  if(user.role!=='admin')return reply({error:'admin_required'},403);const b=await readJson(request),status=['active','suspended','revoked'].includes(b.status)?b.status:null,entitlement=await env.DB.prepare(`SELECT * FROM entitlements WHERE id=?`).bind(String(b.entitlementId||'')).first();if(!status||!entitlement)return reply({error:'invalid_entitlement_status'},400);const now=new Date().toISOString();
  await env.DB.batch([env.DB.prepare(`UPDATE entitlements SET status=?,updated_at=? WHERE id=?`).bind(status,now,entitlement.id),env.DB.prepare(`INSERT INTO admin_audit(id,admin_user_id,subject_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,entitlement.user_id,`entitlement_${status}`,'entitlement',entitlement.id,'success',JSON.stringify({reason:clean(b.reason,500)}),now)]);return reply({id:entitlement.id,status});
}
async function adminActivationAttention(env,user){if(user.role!=='admin')return reply({error:'admin_required'},403);const rows=await env.DB.prepare(`SELECT id,provider,provider_transaction_id,user_email,status,retry_count,processing_error,received_at FROM payment_events WHERE status IN ('activation_needs_attention','awaiting_claim') ORDER BY received_at DESC LIMIT 100`).all();return reply({items:rows.results});}
async function adminAudit(request,env,user){if(user.role!=='admin')return reply({error:'admin_required'},403);const q=`%${String(new URL(request.url).searchParams.get('q')||'').toLowerCase()}%`,rows=await env.DB.prepare(`SELECT a.*,admin.email admin_email,subject.email subject_email FROM admin_audit a LEFT JOIN users admin ON admin.id=a.admin_user_id LEFT JOIN users subject ON subject.id=a.subject_user_id WHERE lower(COALESCE(subject.email,'')) LIKE ? OR lower(a.action) LIKE ? ORDER BY a.created_at DESC LIMIT 100`).bind(q,q).all();return reply({items:rows.results});}

async function applyEntitlementReversal(env,event,n,adminId){
  const entitlement=await env.DB.prepare(`SELECT * FROM entitlements WHERE source=? AND source_transaction_id=?`).bind(n.provider,n.transactionId).first();
  if(!entitlement)return finishPaymentEvent(env,event,'no_matching_entitlement','No entitlement was created by this transaction.');
  const status=n.type==='dispute_opened'?'disputed':n.type==='dispute_resolved_won'?'active':'revoked',now=new Date().toISOString();
  const other=await env.DB.prepare(`SELECT id FROM entitlements WHERE user_id=? AND id!=? AND status='active' AND ends_on>=? LIMIT 1`).bind(entitlement.user_id,entitlement.id,dateOnly(new Date())).first();
  await env.DB.batch([
    env.DB.prepare(`UPDATE entitlements SET status=?,updated_at=? WHERE id=?`).bind(status,now,entitlement.id),
    env.DB.prepare(`UPDATE license_keys SET status=? WHERE entitlement_id=?`).bind(status==='revoked'?'revoked':'claimed',entitlement.id),
    env.DB.prepare(`INSERT INTO admin_audit(id,admin_user_id,subject_user_id,action,related_type,related_id,result,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),adminId,entitlement.user_id,`entitlement_${status}`,'entitlement',entitlement.id,'success',JSON.stringify({paymentEventId:event.id,transactionId:n.transactionId}),now),
    queueEmailByUserId(env,entitlement.user_id,`access_${status}`,{transactionId:n.transactionId,accessContinues:Boolean(other)},'critical',now)
  ]);
  await finishPaymentEvent(env,event,status,null);return {status,entitlementId:entitlement.id};
}

async function finishPaymentEvent(env,event,status,error){
  await env.DB.prepare(`UPDATE payment_events SET status=?,processed_at=?,processing_error=?,next_retry_at=NULL WHERE id=?`).bind(status,new Date().toISOString(),error,event.id).run();return {status};
}

async function recordActivationAttempt(env,event,result,error,manualAdminId){
  const prior=await env.DB.prepare(`SELECT COALESCE(MAX(attempt_number),0) n FROM activation_attempts WHERE payment_event_id=?`).bind(event.id).first(),number=Number(prior.n||0)+1,detail=error?`${error.code}: ${error.message}`:null;
  await env.DB.prepare(`INSERT INTO activation_attempts(id,payment_event_id,attempt_number,result,error_code,error_message,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),event.id,number,result,error?.code||null,detail, new Date().toISOString()).run();
}

function queueEmail(env,user,template,payload,priority,now){return env.DB.prepare(`INSERT INTO notification_queue(id,user_id,template_key,recipient_email,payload_json,priority,status,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)`).bind(crypto.randomUUID(),user.id,template,user.email,JSON.stringify(payload),priority,now,now);}
function queueEmailByUserId(env,userId,template,payload,priority,now){return env.DB.prepare(`INSERT INTO notification_queue(id,user_id,template_key,recipient_email,payload_json,priority,status,next_attempt_at,created_at) SELECT ?,id,?,email,?,?,'pending',?,? FROM users WHERE id=?`).bind(crypto.randomUUID(),template,JSON.stringify(payload),priority,now,now,userId);}
async function queueAdminEmail(env,template,payload,priority,now){
  const admins=await env.DB.prepare(`SELECT id,email FROM users WHERE role='admin' AND status='active' LIMIT 5`).all();
  if(admins.results.length)await env.DB.batch(admins.results.map(admin=>queueEmail(env,admin,template,payload,priority,now)));
}
async function queueRecipientEmail(env,email,template,payload,priority,now){await env.DB.prepare(`INSERT OR IGNORE INTO notification_queue(id,template_key,recipient_email,payload_json,priority,status,next_attempt_at,created_at) VALUES(?,?,?,?,?,'pending',?,?)`).bind(crypto.randomUUID(),template,normalizeEmail(email),JSON.stringify(payload),priority,now,now).run();}

async function runScheduledWork(env,scheduledTime){
  const started=Date.now(),now=new Date(scheduledTime||Date.now()).toISOString(),results={activation:0,email:0,expiry:0,retention:0,interest:0,snapshot:0};
  const retry=await env.DB.prepare(`SELECT id FROM payment_events WHERE status='activation_needs_attention' AND retry_count<3 AND next_retry_at<=? ORDER BY next_retry_at LIMIT 10`).bind(now).all();
  for(const item of retry.results){await processPaymentEvent(env,item.id);results.activation++;if(Date.now()-started>7000)break;}
  if(Date.now()-started<7000)results.expiry=await scheduleExpiryNotices(env,now);
  if(Date.now()-started<7000)results.interest=await postDueInterest(env,now,10);
  if(Date.now()-started<7000)results.snapshot=await captureRecoverySnapshots(env,now,10);
  if(Date.now()-started<7000)results.retention=await applyRetention(env,now,10);
  if(Date.now()-started<7000)results.email=await deliverNotifications(env,now,10);
  console.log('scheduled_work',{...results,elapsedMs:Date.now()-started});return results;
}

async function scheduleExpiryNotices(env,now){
  const today=now.slice(0,10),rows=await env.DB.prepare(`SELECT e.id,e.user_id,e.ends_on,u.email FROM entitlements e JOIN users u ON u.id=e.user_id WHERE e.status='active' AND CAST(julianday(e.ends_on)-julianday(?) AS INTEGER) IN (30,7) LIMIT 10`).bind(today).all();
  await env.DB.prepare(`UPDATE entitlements SET status='expired',updated_at=? WHERE status='active' AND ends_on<?`).bind(now,today).run();
  if(rows.results.length)await env.DB.batch(rows.results.map(x=>queueEmail(env,{id:x.user_id,email:x.email},'renewal_reminder',{entitlementId:x.id,endsOn:x.ends_on,payhipOption:true,contactOption:true},'normal',now)));
  return rows.results.length;
}

async function deliverNotifications(env,now,limit){
  const rows=await env.DB.prepare(`SELECT * FROM notification_queue WHERE status='pending' AND next_attempt_at<=? ORDER BY CASE priority WHEN 'critical' THEN 0 ELSE 1 END,created_at LIMIT ?`).bind(now,limit).all();
  let sent=0;for(const item of rows.results){
    if(env.EMAIL_PROVIDER_MODE!=='brevo'){console.log('development_email',{to:item.recipient_email,template:item.template_key});await env.DB.prepare(`UPDATE notification_queue SET status='sent',sent_at=? WHERE id=?`).bind(now,item.id).run();sent++;continue;}
    try{const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'content-type':'application/json','api-key':env.BREVO_API_KEY},body:JSON.stringify({sender:{email:env.BREVO_SENDER_EMAIL,name:env.BREVO_SENDER_NAME||'Tiny Tools Studio'},to:[{email:item.recipient_email}],subject:emailSubject(item.template_key),htmlContent:emailHtml(item.template_key,safeJson(item.payload_json))})});if(!response.ok)throw new Error(`brevo_${response.status}`);const data=await response.json();await env.DB.prepare(`UPDATE notification_queue SET status='sent',sent_at=?,provider_message_id=? WHERE id=?`).bind(now,String(data.messageId||''),item.id).run();sent++;}catch(error){const attempts=Number(item.attempts||0)+1,next=new Date(Date.now()+Math.min(attempts*30,360)*60000).toISOString();await env.DB.prepare(`UPDATE notification_queue SET attempts=?,next_attempt_at=?,last_error=?,status=? WHERE id=?`).bind(attempts,next,clean(error.message,300),attempts>=3?'failed':'pending',item.id).run();}
  }return sent;
}

async function applyRetention(env,now,limit){
  const today=now.slice(0,10),cutoff24=shiftMonths(today,-24),support=await env.DB.prepare(`DELETE FROM support_references WHERE id IN (SELECT id FROM support_references WHERE closed_at IS NOT NULL AND closed_at<? AND (delete_after IS NULL OR delete_after<=?) LIMIT ?)` ).bind(cutoff24,now,limit).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at<?`).bind(now).run();
  await env.DB.prepare(`DELETE FROM entitlements WHERE id IN (SELECT id FROM entitlements WHERE source IN ('external_admin','test') AND ends_on<? AND status IN ('expired','revoked') LIMIT ?)` ).bind(cutoff24,limit).run();
  await env.DB.prepare(`DELETE FROM admin_audit WHERE id IN (SELECT a.id FROM admin_audit a WHERE a.created_at<? AND a.subject_user_id IN (SELECT u.id FROM users u WHERE u.status='deleted' OR NOT EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id=u.id AND e.ends_on>=?)) AND a.action NOT LIKE '%payment%' AND a.action NOT LIKE '%fraud%' AND a.action NOT LIKE '%dispute%' LIMIT ?)` ).bind(`${cutoff24}T00:00:00.000Z`,cutoff24,limit).run();
  const expiring=await env.DB.prepare(`SELECT u.id,u.email,MAX(e.ends_on) last_end FROM users u JOIN entitlements e ON e.user_id=u.id WHERE u.status='active' GROUP BY u.id HAVING last_end<? AND NOT EXISTS(SELECT 1 FROM entitlements a WHERE a.user_id=u.id AND a.status='active' AND a.ends_on>=?) LIMIT ?`).bind(today,today,limit).all();
  for(const account of expiring.results){const age=daysBetween(account.last_end,today);if(age===335||age===358)await queueEmail(env,account,'data_deletion_warning',{scheduledOn:addDays(account.last_end,365),daysRemaining:365-age},'critical',now).run();if(age>=365)await purgeExpiredFinancialData(env,account.id,now);}
  return Number(support.meta?.changes||0);
}

async function purgeExpiredFinancialData(env,userId,now){
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM expected_income WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM living_plans WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM goals WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM recovery_snapshots WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM recovery_journeys WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM debts WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM creditors WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM ledger_entries WHERE user_id=?`).bind(userId),env.DB.prepare(`DELETE FROM allocation_rules WHERE user_id=?`).bind(userId),env.DB.prepare(`INSERT INTO admin_audit(id,subject_user_id,action,result,detail_json,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),userId,'expired_financial_data_deleted','success',JSON.stringify({retention:'12_months'}),now)
  ]);
}

async function captureRecoverySnapshots(env,now,limit){
  const day=now.slice(0,10),users=await env.DB.prepare(`SELECT user_id FROM recovery_journeys ORDER BY user_id LIMIT ?`).bind(limit).all();
  for(const x of users.results)await env.DB.prepare(`INSERT OR IGNORE INTO recovery_snapshots(id,user_id,snapshot_on,balance_minor,created_at) SELECT ?,?, ?,COALESCE(SUM(current_balance_minor),0),? FROM debts WHERE user_id=? AND status IN ('active','paused','paid')`).bind(crypto.randomUUID(),x.user_id,day,now,x.user_id).run();
  return users.results.length;
}

async function postDueInterest(env,now,limit){
  const day=now.slice(0,10),rows=await env.DB.prepare(`SELECT d.id debt_id,d.user_id,d.current_balance_minor,d.journey_start_balance_minor,v.id version_id,v.interest_mode,v.interest_value,v.interest_frequency,v.interest_basis,v.effective_on,v.due_date FROM debts d JOIN debt_agreement_versions v ON v.id=(SELECT id FROM debt_agreement_versions WHERE debt_id=d.id AND effective_on<=? ORDER BY effective_on DESC,created_at DESC LIMIT 1) WHERE d.status IN ('active','paused') AND v.interest_mode IN ('percentage','fixed') LIMIT ?`).bind(day,limit).all();let count=0;
  for(const x of rows.results){const latest=await env.DB.prepare(`SELECT MAX(cycle_on) cycle_on FROM scheduled_interest_charges WHERE debt_id=? AND agreement_version_id=?`).bind(x.debt_id,x.version_id).first(),cycles=dueInterestCycles(x,latest?.cycle_on||'',day,Math.min(3,limit-count));for(const cycle of cycles){const fresh=await env.DB.prepare(`SELECT current_balance_minor FROM debts WHERE id=?`).bind(x.debt_id).first(),base=x.interest_basis==='original'?Number(x.journey_start_balance_minor):Number(fresh.current_balance_minor),amount=x.interest_mode==='fixed'?moneyMinor(x.interest_value):Math.round(base*Number(x.interest_value)/100);if(amount<=0)continue;const ledgerId=crypto.randomUUID();try{await env.DB.batch([env.DB.prepare(`UPDATE debts SET current_balance_minor=current_balance_minor+?,updated_at=? WHERE id=?`).bind(amount,now,x.debt_id),env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,related_type,related_id,description,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(ledgerId,x.user_id,cycle,'interest','debt_adjustment',amount,'debt',x.debt_id,'Interest added',now,`interest:${x.version_id}:${cycle}`),env.DB.prepare(`INSERT INTO scheduled_interest_charges(id,user_id,debt_id,agreement_version_id,cycle_on,amount_minor,ledger_entry_id,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),x.user_id,x.debt_id,x.version_id,cycle,amount,ledgerId,now)]);count++;}catch(error){if(!/UNIQUE|constraint/i.test(String(error.message)))throw error;}if(count>=limit)return count;}}return count;
}

function ledger(env,x){ return env.DB.prepare(`INSERT INTO ledger_entries(id,user_id,occurred_on,entry_type,category,amount_minor,related_type,related_id,description,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(x.id,x.user.id,x.occurred,x.type,x.category,x.amount,x.relatedType||null,x.relatedId||null,x.description||'',x.now,x.key); }
async function latestAllocation(env,user,date){ return env.DB.prepare('SELECT * FROM allocation_rules WHERE user_id=? AND effective_from<=? ORDER BY effective_from DESC,created_at DESC LIMIT 1').bind(user.id,date).first(); }
async function categoryBalance(env,user,category){ const row=await env.DB.prepare('SELECT COALESCE(SUM(amount_minor),0) balance FROM ledger_entries WHERE user_id=? AND category=?').bind(user.id,category).first(); return Number(row.balance||0); }
function allocateMinor(total,rule){ const keys=['living','debt','savings','fun'],parts={},raw=keys.map(k=>total*Number(rule[`${k}_percentage`])/100),base=raw.map(Math.floor),remainder=total-base.reduce((a,b)=>a+b,0); keys.forEach((k,i)=>parts[k]=base[i]); const rank=raw.map((v,i)=>[i,v-base[i]]).sort((a,b)=>b[1]-a[1]); for(let i=0;i<remainder;i++)parts[keys[rank[i%rank.length][0]]]++; return parts; }
function calculateRecovery(starting,current,target,correction=0){const comparableStart=Number(starting)+Number(correction),recoveredMinor=Math.max(comparableStart-Number(current),0),base=Math.max(comparableStart-Number(target),1);return {comparableStartingDebtMinor:comparableStart,recoveredMinor,recoveredPercentage:Math.min(recoveredMinor/base*100,100)};}
function validCategory(v){ return ['living','debt','savings','fun'].includes(v)?v:null; }
function interestMode(v){ return ['none','included','percentage','fixed'].includes(v)?v:null; }
function interestFrequency(v){ return ['daily','weekly','monthly'].includes(v)?v:null; }
function validDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null; }
function dateOnly(d){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d); }
function clean(v,max){ return String(v||'').trim().replace(/\s+/g,' ').slice(0,max); }
function normalizeEmail(v){ return String(v||'').trim().toLowerCase(); }
function moneyMinor(v){ const n=Number(v); return Number.isFinite(n)?Math.round(n*100):NaN; }
function idempotency(request){ return clean(request.headers.get('idempotency-key'),120)||crypto.randomUUID(); }
async function readJson(request){ try{return await request.json();}catch{return{};} }
function safeUser(u){ return {id:u.id,email:u.email,name:u.name,role:u.role}; }
function randomToken(){ const b=new Uint8Array(32);crypto.getRandomValues(b);return base64url(b); }
async function sha256(v){ return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function base64url(bytes){ let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function cookie(value,maxAge){ return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function cookieValue(header,name){ const match=String(header||'').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));return match?match[1]:''; }
function reply(body,statusOrInit=200,extra={}){ const init=typeof statusOrInit==='number'?{status:statusOrInit}:statusOrInit;return new Response(JSON.stringify(body),{...init,...extra,headers:{...JSON_HEADERS,...(init.headers||{}),...(extra.headers||{})}}); }
function originAllowed(request,env){const origin=request.headers.get('origin');return Boolean(origin&&String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(origin));}
function cors(response,request,env){ const origin=request.headers.get('origin'),allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()); if(origin&&allowed.includes(origin)){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','origin');response.headers.set('access-control-allow-credentials','true');response.headers.set('access-control-allow-headers','content-type,idempotency-key');response.headers.set('access-control-allow-methods','GET,POST,PUT,DELETE,OPTIONS');}return response; }

function safeJson(value){try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return{};}}
function normalizePaymentEvent(p){
  const provider=['payhip','paypal'].includes(String(p.provider||'').toLowerCase())?String(p.provider).toLowerCase():null,type=['payment_completed','refund','reversal','dispute_opened','dispute_resolved_won','dispute_resolved_lost'].includes(p.type)?p.type:null,eventId=clean(p.eventId,160),transactionId=clean(p.transactionId,160),email=normalizeEmail(p.email),plan=String(p.plan||'');
  if(!provider||!type||!eventId||!transactionId||!email.includes('@'))return null;
  return {provider,type,eventId,transactionId,email,plan,licenseKey:clean(p.licenseKey,240),amountMinor:Number.isInteger(p.amountMinor)?p.amountMinor:moneyMinor(p.amount),currency:clean(p.currency||'PHP',8).toUpperCase()};
}
function constantEqual(a,b){a=String(a);b=String(b);let mismatch=a.length^b.length,n=Math.max(a.length,b.length);for(let i=0;i<n;i++)mismatch|=(a.charCodeAt(i%Math.max(a.length,1))||0)^(b.charCodeAt(i%Math.max(b.length,1))||0);return mismatch===0;}
function addMonths(date,months){const [y,m,d]=date.split('-').map(Number),last=new Date(Date.UTC(y,m-1+months+1,0)).getUTCDate(),out=new Date(Date.UTC(y,m-1+months,Math.min(d,last)));return out.toISOString().slice(0,10);}
function shiftMonths(date,months){return addMonths(date,months);}
function addDays(date,days){const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function daysBetween(start,end){const a=Date.parse(`${start}T00:00:00Z`),b=Date.parse(`${end}T00:00:00Z`);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(Math.floor((b-a)/86400000),0):0;}
function isInterestCycleDue(agreement,day){
  const start=agreement.due_date||agreement.effective_on;if(!validDate(start)||day<start)return false;const elapsed=daysBetween(start,day);
  if(agreement.interest_frequency==='daily')return true;
  if(agreement.interest_frequency==='weekly')return elapsed%7===0;
  const [,startMonth,startDay]=start.split('-').map(Number),[year,month,currentDay]=day.split('-').map(Number),last=new Date(Date.UTC(year,month,0)).getUTCDate();
  return currentDay===Math.min(startDay,last);
}
function dueInterestCycles(agreement,lastCycle,today,limit=3){
  const result=[],first=agreement.due_date||agreement.effective_on;if(!validDate(first)||today<first||limit<=0)return result;let next=lastCycle?nextInterestCycle(lastCycle,agreement.interest_frequency,first):first;
  while(next<=today&&result.length<limit){if(next>=agreement.effective_on)result.push(next);next=nextInterestCycle(next,agreement.interest_frequency,first);}return result;
}
function nextInterestCycle(date,frequency,anchor=date){if(frequency==='daily')return addDays(date,1);if(frequency==='weekly')return addDays(date,7);const [year,month]=date.split('-').map(Number),anchorDay=Number(anchor.slice(8,10)),nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,last=new Date(Date.UTC(nextYear,nextMonth,0)).getUTCDate();return `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(Math.min(anchorDay,last)).padStart(2,'0')}`;}
function emailSubject(key){return ({access_active:'Your Debt Recovery System access is active',purchase_ready_claim:'Your purchase is ready to activate',payment_received_pending:'Payment received—access setup is pending',activation_needs_attention:'Activation needs attention',renewal_reminder:'Your Debt Recovery System access is expiring',data_deletion_warning:'Your Debt Recovery System data is scheduled for deletion',access_disputed:'Your access is temporarily suspended',access_revoked:'Your access has changed',access_active_resolution:'Your access is active again'})[key]||'Debt Recovery System update';}
function emailHtml(key,payload){
  const title=escapeHtml(emailSubject(key)),details=escapeHtml(JSON.stringify(payload));
  const messages={
    payment_received_pending:'Your payment has been received. Access setup is pending while we recover an activation issue. Please do not purchase again for this transaction.',
    purchase_ready_claim:'Your payment is verified. Sign in to the Debt Recovery System with your Google account and activate the license issued for this purchase.',
    access_active:`Your access is active${payload.endsOn?` through ${escapeHtml(payload.endsOn)}`:''}.`,
    activation_needs_attention:'A verified purchase could not be activated after three attempts and requires Admin review.',
    renewal_reminder:`Your access ends on ${escapeHtml(payload.endsOn||'the date shown in your account')}. You may renew through Payhip, or contact Tiny Tools Studio if you prefer an approved external renewal. Renewal is not automatic.`,
    data_deletion_warning:`Your expired account data is scheduled for deletion in ${escapeHtml(payload.daysRemaining)} days unless you renew before the scheduled date.`,
    access_disputed:`The entitlement created by the affected transaction is disputed and temporarily suspended.${payload.accessContinues?' Another valid entitlement remains active, so access continues.':''}`,
    access_revoked:`The entitlement created by the affected transaction was revoked.${payload.accessContinues?' Another valid entitlement remains active, so access continues.':''}`
  };
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17352c"><h1 style="font-size:22px">${title}</h1><p>${messages[key]||'There is an update to your Debt Recovery System access.'}</p><p style="font-size:12px;color:#66736d">Reference details: ${details}</p></div>`;
}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

export {allocateMinor,calculateRecovery,addMonths,daysBetween,isInterestCycleDue,dueInterestCycles,normalizePaymentEvent,normalizePayhipEvent,normalizePayPalEvent,parseProductMap,mappedPlan,verifyPayhipWebhook};
