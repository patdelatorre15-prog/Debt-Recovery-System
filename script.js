const TODAY = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const MONTH = TODAY.slice(0,7);
const NAV = [
  ['dashboard','⌂','Dashboard'],['income','＋','Income'],['living','⌑','Living Expenses'],
  ['savings','◇','Savings'],['fun','☆','Fun'],['debt','▤','Debt'],
  ['actions','⇄','Actions'],['recovery','↘','Recovery'],['account','○','Account']
];
const DEFAULT_STATE = {
  page:'dashboard',
  allocations:[
    {key:'living',name:'Living Expenses',percentage:40},
    {key:'debt',name:'Debt',percentage:55},
    {key:'savings',name:'Savings',percentage:4},
    {key:'fun',name:'Fun',percentage:1}
  ],
  funds:{living:6240,debt:38400,savings:6240,fun:1200},
  incomes:[
    {id:'i1',date:'2026-08-24',source:'Other income',description:'Pat Payday 2',amount:50000,allocated:true},
    {id:'i2',date:'2026-08-15',source:'Salary',description:'Salary',amount:52000,allocated:true}
  ],
  expected:[
    {id:'e1',date:'2026-09-05',name:'Salary',source:'Salary',amount:52000,status:'Expected'},
    {id:'e2',date:'2026-08-24',name:'Pat Payday 2',source:'Other income',amount:50000,status:'Received'}
  ],
  bills:[
    {id:'b1',name:'Electricity',plan:6000,actual:7200,dueDay:2,status:'Needs review'},
    {id:'b2',name:'Internet',plan:2200,actual:2200,dueDay:5,status:'Upcoming'},
    {id:'b3',name:'Rent',plan:12000,actual:12000,dueDay:15,status:'Paid'}
  ],
  budgets:[
    {id:'m1',name:'Groceries',plan:6500,spent:4100},
    {id:'m2',name:'Health',plan:2500,spent:900},
    {id:'m3',name:'Transport',plan:1400,spent:500}
  ],
  goals:{
    savings:[
      {id:'sg1',name:'Emergency Fund – Phase 1',type:'target',target:50000,balance:1800},
      {id:'sg2',name:'Medical Emergency Fund',type:'target',target:310000,balance:392}
    ],
    fun:[
      {id:'fg1',name:'Travel Fund',type:'sinking',target:25000,balance:4200},
      {id:'fg2',name:'Date Nights',type:'continuous',target:0,balance:850}
    ]
  },
  debts:[
    {id:'d1',creditor:'Credit Card A',balance:310000,starting:240000,payment:11500,dueDate:'2026-08-26',status:'Overdue',interestMode:'percentage',interestValue:3,interestFrequency:'monthly',paused:false,created:'2026-08-13'},
    {id:'d2',creditor:'Private Loan – Ana',balance:240000,starting:240000,payment:7200,dueDate:'2026-09-12',status:'Paused',interestMode:'fixed',interestValue:7200,interestFrequency:'monthly',paused:true,created:'2026-08-13'},
    {id:'d3',creditor:'Home Loan',balance:1911577,starting:1911577,payment:28000,dueDate:'2026-09-12',status:'Upcoming',interestMode:'included',interestValue:0,interestFrequency:'monthly',paused:false,created:'2026-08-13'},
    {id:'d4',creditor:'Personal Loan',balance:480000,starting:500000,payment:7800,dueDate:'2026-09-18',status:'Upcoming',interestMode:'none',interestValue:0,interestFrequency:'monthly',paused:false,created:'2026-08-13'}
  ],
  journey:{startDate:'2026-08-13',startingDebt:2912273,targetBalance:0,targetDate:'',noNewDebtSince:'2026-08-20'},
  recoveryPoints:[
    {date:'2026-04-30',balance:2860000},{date:'2026-05-31',balance:2890000},{date:'2026-06-30',balance:2815000},
    {date:'2026-07-31',balance:2901000},{date:'2026-08-31',balance:2941577}
  ],
  activities:[
    {id:'a1',date:'2026-08-28',category:'debt',type:'interest',title:'Interest added · Private Loan – Ana',detail:'Fixed monthly amount',amount:7200},
    {id:'a2',date:'2026-08-25',category:'debt',type:'payment',title:'Payment made · Credit Card A',detail:'Interest first, then principal',amount:-11500},
    {id:'a3',date:'2026-08-25',category:'savings',type:'goal',title:'Added to Emergency Fund – Phase 1',detail:'From available Savings funds',amount:1500},
    {id:'a4',date:'2026-08-24',category:'income',type:'income',title:'Pat Payday 2 received',detail:'Allocation breakdown recorded',amount:50000},
    {id:'a5',date:'2026-08-24',category:'living',type:'allocation',title:'Income allocation received',detail:'Pat Payday 2 · 40%',amount:20000},
    {id:'a6',date:'2026-08-24',category:'debt',type:'allocation',title:'Income allocation received',detail:'Pat Payday 2 · 55%',amount:27500},
    {id:'a7',date:'2026-08-24',category:'savings',type:'allocation',title:'Income allocation received',detail:'Pat Payday 2 · 4%',amount:2000},
    {id:'a8',date:'2026-08-24',category:'fun',type:'allocation',title:'Income allocation received',detail:'Pat Payday 2 · 1%',amount:500},
    {id:'a9',date:'2026-08-20',category:'debt',type:'negotiated',title:'Negotiated balance · Personal Loan',detail:'Reduced from ₱500,000 to ₱480,000',amount:-20000}
  ],
  transfers:[]
};

const clone = value => JSON.parse(JSON.stringify(value));
let state = loadState();
const $ = selector => document.querySelector(selector);
const app = $('#app');
const h = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = value => `${Number(value||0)<0?'−':''}₱${Math.abs(Number(value||0)).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const shortDate = value => new Date(value+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'2-digit',year:value.slice(0,4)!=='2026'?'numeric':undefined});
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function loadState(){ try { return Object.assign(clone(DEFAULT_STATE),JSON.parse(localStorage.getItem('drs-demo-state')||'{}')); } catch { return clone(DEFAULT_STATE); } }
function saveState(){ localStorage.setItem('drs-demo-state',JSON.stringify(state)); }
function currentDebt(){ return state.debts.reduce((sum,d)=>sum+Number(d.balance),0); }
function activitiesFor(category){ return state.activities.filter(a=>!category||a.category===category).sort((a,b)=>b.date.localeCompare(a.date)); }
function addActivity(category,type,title,detail,amount,date=TODAY){ state.activities.unshift({id:uid('a'),date,category,type,title,detail,amount:Number(amount)}); }
function header(title,subtitle,actions=''){ $('#pageTitle').textContent=title; $('#pageSubtitle').textContent=subtitle; $('#pageActions').innerHTML=actions; }
function button(label,action,kind='button'){ return `<button class="${kind}" data-action="${action}">${label}</button>`; }
function card(title,body,action='',subtitle=''){ return `<section class="card"><div class="card-header"><div><h2>${h(title)}</h2>${subtitle?`<p>${h(subtitle)}</p>`:''}</div>${action}</div>${body}</section>`; }
function metric(label,value,note='',tone=''){ return `<div class="metric"><span class="metric-label">${label}</span><strong class="metric-value ${tone}">${value}</strong>${note?`<span class="metric-note">${note}</span>`:''}</div>`; }
function track(value,max,tone=''){ const pct=max>0?Math.min(100,Math.max(0,value/max*100)):0; return `<div class="track ${tone}"><i style="width:${pct}%"></i></div>`; }
function pill(text,tone=''){ return `<span class="pill ${tone}">${h(text)}</span>`; }
function notice(message,error=false){ $('#noticeRegion').innerHTML=`<div class="notice ${error?'error':''}"><span>${message}</span><button aria-label="Dismiss" onclick="this.parentElement.remove()">×</button></div>`; window.scrollTo({top:0,behavior:'smooth'}); }

function renderNav(){
  $('#navigation').innerHTML=NAV.map(([key,icon,label])=>`<button class="nav-button ${state.page===key?'active':''}" data-page="${key}" ${state.page===key?'aria-current="page"':''}><span class="nav-icon">${icon}</span>${label}</button>`).join('');
}
function go(page){ state.page=page; saveState(); render(); $('#sidebar').classList.remove('open'); window.scrollTo(0,0); }
function render(){ renderNav(); const views={dashboard:renderDashboard,income:renderIncome,living:renderLiving,savings:()=>renderFundsPage('savings'),fun:()=>renderFundsPage('fun'),debt:renderDebt,actions:renderActions,recovery:renderRecovery,account:renderAccount}; (views[state.page]||renderDashboard)(); }

function activitySection(category,title='Activity'){
  const rows=activitiesFor(category).slice(0,4);
  return card(title,`<div class="activity-list">${rows.length?rows.map(activityRow).join(''):`<div class="empty">No activity recorded yet.</div>`}</div>`,`<button class="link-button" data-action="view-activity" data-category="${category||''}">View all →</button>`);
}
function activityRow(a){
  const isBad=['interest','new-debt'].includes(a.type);
  const sign=a.amount>0?'+':'';
  return `<div class="activity-row"><span class="date">${shortDate(a.date)}</span><span class="activity-icon ${isBad?'bad':''}" aria-hidden="true">${a.amount<0?'↓':'↑'}</span><div><span class="row-title">${h(a.title)}</span><span class="row-subtitle">${h(a.detail||'')}</span></div>${pill(a.type.replace('-',' '),isBad?'bad':'')}<span class="amount ${isBad?'negative':a.amount>=0?'positive':''}">${sign}${money(a.amount)}</span></div>`;
}

function renderDashboard(){
  header('Your financial month','See what needs attention and where your money is going.');
  const debtDue=state.debts.filter(d=>d.dueDate.startsWith(MONTH)).reduce((s,d)=>s+d.payment,0);
  const paid=Math.abs(activitiesFor('debt').filter(a=>a.type==='payment'&&a.date.startsWith(MONTH)).reduce((s,a)=>s+a.amount,0));
  const unpaid=Math.max(debtDue-paid,0)+state.bills.reduce((s,b)=>s+Math.max(b.actual-Number(b.paid||0),0),0);
  const attention=state.attention||[
    ['OVERDUE · 5 DAYS','Credit Card A','Minimum payment',11500],['BILL NEEDS REVIEW','Electricity','Actual is above the monthly plan',1200],
    ['SHORT BY ₱3,800','Debt allocation','New allocation will cover this negative first',3800],['NEW ALLOCATION','Debt funds received','Previous negative was deducted first',5000]
  ];
  const attentionHtml=attention.length?`<div class="attention-grid">${attention.map((x,i)=>`<div class="attention-item ${i%2?'attention-separator':''}"><span class="attention-code">${x[0]}</span><div><span class="row-title">${x[1]}</span><span class="row-subtitle">${x[2]}</span></div><span class="amount">${money(x[3])} ›</span></div>`).join('')}</div>`:`<div class="empty">Nothing needs attention right now.</div>`;
  const allocationHtml=state.allocations.map(x=>`<div class="allocation-row"><div><span>${x.name} · ${x.percentage}%</span><b>${money(50000*x.percentage/100)}</b></div>${track(x.percentage,100)}</div>`).join('');
  app.innerHTML=`
    <div class="metrics">${metric('Available this month',money(Object.values(state.funds).reduce((a,b)=>a+b,0)),'Across all categories','positive')}${metric('Due this month',money(debtDue),'Scheduled debt payments')}${metric('Paid this month',money(paid),'Debt payments recorded','positive')}${metric('Unpaid this month',money(unpaid),'Bills and debt still due','negative')}</div>
    ${card('Needs attention',attentionHtml,`<button class="link-button" data-action="attention-all">View all →</button>`)}
    <div class="grid-2">${card('Monthly allocation',allocationHtml,`<button class="link-button" data-action="allocation-settings">Manage →</button>`,'Current percentages apply only to future income')}${card('Recovery snapshot',`<div class="recovery-hero"><div class="recovery-stat"><span class="metric-label">Starting debt</span><strong class="metric-value">${money(state.journey.startingDebt)}</strong></div><div class="recovery-stat"><span class="metric-label">Current debt</span><strong class="metric-value">${money(currentDebt())}</strong></div><div class="recovery-stat"><span class="metric-label">Change</span><strong class="metric-value ${currentDebt()>state.journey.startingDebt?'negative':'positive'}">${currentDebt()>state.journey.startingDebt?'+':''}${money(currentDebt()-state.journey.startingDebt)}</strong></div><div class="recovery-stat"><span class="metric-label">Recovered</span><strong class="metric-value">${Number(state.recoverySummary?.recoveredPercentage||0).toFixed(1)}%</strong></div></div><div class="recovery-message">${currentDebt()>state.journey.startingDebt?`Your current balance is ${money(currentDebt()-state.journey.startingDebt)} above the journey start.`:`You have recovered ${money(state.recoverySummary?.recoveredMinor??state.journey.startingDebt-currentDebt())}.`}</div>`,`<button class="link-button" data-page="recovery">View Recovery →</button>`)}</div>
    ${card('Wins & milestones',winsHtml(),`<button class="link-button" data-page="recovery">View Recovery →</button>`)}
    ${activitySection('', 'Recent activity')}`;
}

function renderIncome(){
  header('Income','Record received income and plan what is expected.',button('+ Add income','add-income'));
  const incomeRows=state.incomes.map(i=>`<div class="list-row compact"><span class="date">${shortDate(i.date)}</span><div><span class="row-title">${h(i.description)}</span><span class="row-subtitle">${h(i.source)} · allocated automatically</span></div><span class="amount positive">+${money(i.amount)}</span><button class="button-secondary" data-action="income-breakdown" data-id="${h(i.id)}">Breakdown</button></div>`).join('');
  const expectedRows=state.expected.map(i=>`<div class="list-row compact"><span class="date">${shortDate(i.date)}</span><div><span class="row-title">${h(i.name)}</span><span class="row-subtitle">${h(i.source)} · expected ${money(i.amount)}</span></div>${pill(i.status,i.status==='Received'?'':'gold')}<div class="row-actions"><span class="amount">${money(i.amount)}</span>${i.status==='Expected'?`<button class="button-secondary" data-action="receive-expected" data-id="${h(i.id)}">Receive</button>`:''}</div></div>`).join('');
  app.innerHTML=`<div class="grid-2">${card('Income received',`<div class="list">${incomeRows}</div>`,'','Allocation is recorded with every received income')}${card('Expected income',`<div class="list">${expectedRows}</div>`,`<button class="link-button" data-action="manage-income">Manage plans</button>`)}</div>${activitySection('income','Income activity')}`;
}

function renderLiving(){
  const planned=state.bills.reduce((s,b)=>s+b.plan,0)+state.budgets.reduce((s,b)=>s+b.plan,0);
  const spent=state.bills.reduce((s,b)=>s+Number(b.paid??(b.status==='Paid'?b.actual:0)),0)+state.budgets.reduce((s,b)=>s+b.spent,0);
  const due=state.bills.reduce((s,b)=>s+Math.max(b.actual-Number(b.paid||0),0),0);
  header('Living Expenses','Stay ahead of bills and everyday spending.',button('+ Add funds','add-funds')+button('+ Record expense','record-expense'));
  const bills=state.bills.map(b=>`<div class="list-row"><span class="date">${String(b.dueDay).padStart(2,'0')}</span><div><span class="row-title">${h(b.name)}</span><span class="row-subtitle">${b.actual>b.plan?`Actual is ${money(b.actual-b.plan)} above the ${money(b.plan)} plan`:'Monthly bill'}</span></div>${pill(b.status,b.status==='Needs review'?'bad':'')}<span class="amount">${money(Math.max(b.actual-Number(b.paid||0),0))}</span><div class="row-actions">${b.status!=='Paid'?`<button class="button-secondary" data-action="pay-bill" data-id="${h(b.id)}">Pay</button>`:''}</div></div>`).join('');
  const budgets=state.budgets.map(b=>`<div class="goal-row"><div><span class="row-title">${h(b.name)}</span><span class="row-subtitle">${money(b.spent)} of ${money(b.plan)}</span></div><div>${track(b.spent,b.plan,b.spent>b.plan?'coral':'')}</div><span class="amount">${money(b.plan-b.spent)}</span><button class="button-secondary" data-action="log-expense" data-id="${h(b.id)}">Log expense</button></div>`).join('');
  app.innerHTML=`<div class="metrics">${metric('Monthly plan',money(planned))}${metric('Paid / spent',money(spent))}${metric('Still due',money(due),'Unpaid bills','negative')}${metric('Available funds',money(state.funds.living),'Living Expenses balance','positive')}</div><div class="grid-2">${card('Bills',`<div class="list">${bills}</div>`,`<button class="link-button" data-action="manage-bills">Manage</button>`)}${card('Monthly spending',`<div class="goal-list">${budgets}</div>`,`<button class="link-button" data-action="manage-budgets">Manage budget</button>`)}</div>${activitySection('living','Living Expenses activity')}`;
}

function renderFundsPage(type){
  const isSavings=type==='savings', label=isSavings?'Savings':'Fun', pool=state.funds[type], goals=state.goals[type];
  header(label,isSavings?'Separate available money from savings goals.':'Track discretionary funds and goals.',button('+ Add funds','add-funds')+button('Use funds','use-funds','button-secondary'));
  const reserved=goals.reduce((s,g)=>s+g.balance,0);
  const rows=goals.map(g=>`<div class="goal-row"><div><span class="row-title">${h(g.name)}</span><span class="row-subtitle">${g.type==='continuous'?'Continuous fund · no target':`${money(g.balance)} of ${money(g.target)}`}</span></div><div>${g.target?track(g.balance,g.target):'<span class="micro">No target · keep adding anytime</span>'}</div><span class="goal-balance amount">${money(g.balance)}</span><div class="row-actions"><button class="button-secondary" data-action="allocate-goal" data-id="${h(g.id)}">Allocate</button><button class="button-ghost" data-action="use-funds" data-id="${h(g.id)}">Use</button></div></div>`).join('');
  app.innerHTML=`<div class="metrics">${metric(`Available ${label}`,money(pool),'Not assigned to a goal','positive')}${metric('Reserved in goals',money(reserved))}${metric('Added this month',money(activitiesFor(type).filter(a=>a.date.startsWith(MONTH)&&a.amount>0).reduce((s,a)=>s+a.amount,0)),'Allocations and direct funds','positive')}</div><div class="grid-2"><div class="fund-pool"><span class="eyebrow">AVAILABLE ANYTIME</span><h2>Power ${label}</h2><strong class="metric-value">${money(pool)}</strong><p class="page-subtitle">Money not assigned to a specific goal.</p></div>${card(`${label} goals`,`<div class="goal-list">${rows}</div>`,`<button class="link-button" data-action="new-goal">New goal</button>`)}</div>${activitySection(type,`${label} activity`)}`;
}

function renderDebt(){
  const due=state.debts.filter(d=>d.dueDate.startsWith(MONTH)).reduce((s,d)=>s+d.payment,0);
  const paid=Math.abs(activitiesFor('debt').filter(a=>a.type==='payment'&&a.date.startsWith(MONTH)).reduce((s,a)=>s+a.amount,0));
  const unpaid=Math.max(due-paid,0);
  header('Debt','Understand every balance, due date, agreement, and change.',button('Add funds','add-funds','button-secondary')+button('Record payment','record-payment','button-secondary')+button('+ Add debt','add-debt'));
  const rows=state.debts.map(d=>`<tr><td><span class="debt-name">${h(d.creditor)}</span><span class="row-subtitle">${h(interestLabel(d))}</span></td><td>${pill(d.status,d.status==='Overdue'?'bad':d.status==='Paused'?'gold':'')}</td><td>${shortDate(d.dueDate)}</td><td class="amount">${money(d.payment)}</td><td class="amount">${money(d.balance)}</td><td><div class="row-actions"><button class="button-secondary" data-action="record-payment" data-id="${h(d.id)}">Pay</button><button class="button-ghost" data-action="debt-history" data-id="${h(d.id)}">History</button></div></td></tr>`).join('');
  app.innerHTML=`<div class="metrics five">${metric('Current debt',money(currentDebt()))}${metric('Debt funds available',money(state.funds.debt),'Ready for payments','positive')}${metric('Due this month',money(due))}${metric('Paid this month',money(paid),'Recorded payments','positive')}${metric('Unpaid this month',money(unpaid),'Still required','negative')}</div>${card('Debt accounts',`<div style="overflow:auto"><table class="debt-table"><thead><tr><th>Creditor / agreement</th><th>Status</th><th>Next due</th><th class="amount">Payment</th><th class="amount">Balance</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,`<button class="link-button" data-action="view-debts">View all debt accounts →</button>`)}${activitySection('debt','Recent debt activity')}`;
}
function interestLabel(d){ if(d.interestMode==='none')return'No interest'; if(d.interestMode==='included')return'Interest included in total'; if(d.interestMode==='fixed')return`${money(d.interestValue)} fixed ${d.interestFrequency} interest`; return`${d.interestValue}% ${d.interestFrequency} interest`; }

function renderActions(){
  header('Actions','Move existing funds from one category to another.',button('Move funds','move-funds'));
  const rows=state.transfers.slice().reverse().map(t=>`<div class="list-row compact"><span class="date">${shortDate(t.date)}</span><div><span class="row-title">${labelFor(t.from)} → ${labelFor(t.to)}</span><span class="row-subtitle">Fund transfer</span></div><span class="amount">${money(t.amount)}</span><span></span></div>`).join('');
  app.innerHTML=`${card('Move funds',`<p class="page-subtitle">Transfers change category balances only. They are not new income or expenses.</p><div class="breakdown-box">${Object.entries(state.funds).map(([k,v])=>`<div class="breakdown-row"><span>${labelFor(k)}</span><b>${money(v)}</b></div>`).join('')}</div>`,button('Start transfer','move-funds'))}${card('Transfer history',rows?`<div class="list">${rows}</div>`:`<div class="empty">No fund transfers recorded yet.</div>`)}`;
}

function renderRecovery(){
  const current=currentDebt(), change=current-state.journey.startingDebt,recovered=state.recoverySummary?.recoveredPercentage??Math.max(0,(state.journey.startingDebt-current)/Math.max(state.journey.startingDebt,1)*100);
  header('Recovery','See how far you’ve come and where you’re headed.');
  app.innerHTML=`<div class="split-wide">${card('Your debt recovery',`<div class="recovery-hero"><div class="recovery-stat"><span class="metric-label">Starting debt</span><strong class="metric-value">${money(state.journey.startingDebt)}</strong><span class="metric-note">${shortDate(state.journey.startDate)}</span></div><div class="recovery-stat"><span class="metric-label">Current debt</span><strong class="metric-value">${money(current)}</strong><span class="metric-note">As of ${shortDate(TODAY)}</span></div><div class="recovery-stat"><span class="metric-label">Overall ${change>0?'increase':'reduction'}</span><strong class="metric-value ${change>0?'negative':'positive'}">${change>0?'+':''}${money(change)}</strong><span class="metric-note">Since journey start</span></div><div class="recovery-stat"><span class="metric-label">Recovered</span><strong class="metric-value">${Number(recovered).toFixed(1)}%</strong></div></div><div class="recovery-message">${change>0?`Your debt is currently ${money(change)} above your starting balance.`:`You have recovered ${money(Math.abs(change))} since your journey began.`}</div>`)}${card('Recovery goal',`<div class="breakdown-row"><span>Journey start</span><b>${shortDate(state.journey.startDate)}</b></div><div class="breakdown-row"><span>Starting debt</span><b>${money(state.journey.startingDebt)}</b></div><div class="breakdown-row"><span>Target balance</span><b>${money(state.journey.targetBalance)}</b></div><div class="breakdown-row"><span>Target date</span><b>${state.journey.targetDate?shortDate(state.journey.targetDate):'Not set'}</b></div><div class="recovery-message">Journey Start and Starting Debt stay fixed.</div>`,`<div class="row-actions"><button class="link-button" data-action="journey-details">Details</button><button class="link-button" data-action="edit-recovery">Edit</button></div>`)}</div><div class="grid-2">${card('Your debt over time',graphHtml(),'','Monthly movement of your total debt balance')}${card(`Payments vs adjustments — ${new Date(TODAY+'T00:00:00').toLocaleDateString('en-PH',{month:'long'})}`,breakdownHtml())}</div>${card('Wins & milestones',winsHtml(),`<button class="link-button" data-action="milestones-all">View all →</button>`)}${card('Recovery timeline',recoveryTimeline(),`<button class="link-button" data-action="milestones-all">View all →</button>`,'Only debts cleared and meaningful recovery milestones')}`;
}
function graphHtml(){
  const points=state.recoveryPoints.length?state.recoveryPoints:[{date:TODAY,balance:currentDebt()}],values=points.map(x=>x.balance), rawMin=Math.min(...values),rawMax=Math.max(...values),min=rawMin===rawMax?rawMin*.98:rawMin*.98,max=rawMin===rawMax?rawMax*1.02:rawMax*1.02,w=720,h=250,pad=34;
  const pts=values.map((v,i)=>[values.length===1?w/2:pad+i*(w-pad*2)/(values.length-1),h-pad-(v-min)/Math.max(max-min,1)*(h-pad*2)]);
  const line=pts.map(p=>p.join(',')).join(' '), area=`${pad},${h-pad} ${line} ${w-pad},${h-pad}`;
  return `<div class="line-graph"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Debt balance trend"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e8067" stop-opacity=".30"/><stop offset="1" stop-color="#1e8067" stop-opacity=".02"/></linearGradient></defs>${[.25,.5,.75].map(v=>`<line class="graph-grid" x1="${pad}" x2="${w-pad}" y1="${pad+(h-pad*2)*v}" y2="${pad+(h-pad*2)*v}"/>`).join('')}<polygon class="graph-area" points="${area}"/><polyline class="graph-line" points="${line}"/>${pts.map((p,i)=>`<circle class="graph-dot" cx="${p[0]}" cy="${p[1]}" r="5"/><text class="graph-label" text-anchor="middle" x="${p[0]}" y="${h-5}">${new Date(points[i].date+'T00:00:00').toLocaleDateString('en-PH',{month:'short'})}</text>`).join('')}</svg></div>`;
}
function breakdownHtml(){
  const b=state.recoveryBreakdown||{payments:-62513.8,negotiated:-20000,corrections:0,interest:36478,newDebt:75339.8},data=[['Payments made',b.payments,'positive'],['Negotiated reductions',b.negotiated,'positive'],['Corrections',b.corrections,''],['Interest added',b.interest,'negative'],['Debt added',b.newDebt,'negative']];
  const net=data.reduce((s,x)=>s+x[1],0);
  return data.map(x=>`<div class="breakdown-row"><span>${x[0]}</span><b class="${x[2]}">${x[1]>0?'+':''}${money(x[1])}</b></div>`).join('')+`<div class="breakdown-row total"><span>Net balance change</span><b class="${net>0?'negative':'positive'}">${net>0?'+':''}${money(net)}</b></div>`;
}
function winsHtml(){
  const cleared=state.recoverySummary?.debtsCleared??state.debts.filter(d=>d.balance<=.001).length;
  const streak=state.recoverySummary?.noNewDebtDays??Math.max(0,Math.floor((new Date(TODAY)-new Date(state.journey.noNewDebtSince))/86400000)),negotiated=Math.abs(state.recoveryBreakdown?.negotiated??-20000);
  return `<div class="wins-grid"><div class="win-card"><span class="win-icon">✓</span><span class="row-title">No new debt streak</span><span class="metric-value">${streak} days</span><span class="row-subtitle">Keep protecting the progress</span></div><div class="win-card"><span class="win-icon">★</span><span class="row-title">Debts cleared</span><span class="metric-value">${cleared}</span><span class="row-subtitle">Accounts fully paid and closed</span></div><div class="win-card"><span class="win-icon">↘</span><span class="row-title">Negotiated recovery</span><span class="metric-value">${money(negotiated)}</span><span class="row-subtitle">Balance formally reduced</span></div></div>`;
}
function recoveryTimeline(){
  const rows=state.activities.filter(a=>['cleared','milestone','negotiated'].includes(a.type)).slice(0,4);
  return `<div class="activity-list">${rows.length?rows.map(activityRow).join(''):`<div class="empty">Debt-cleared and recovery milestones will appear here.</div>`}</div>`;
}

function renderAccount(){
  header('Account','Manage access, privacy, and your records.');
  const access=state.accountAccess||{status:'Active',plan:'Development entitlement',endsOn:''};app.innerHTML=`<div class="grid-2">${card('Access',`<div class="breakdown-row"><span>Status</span>${pill(access.status)}</div><div class="breakdown-row"><span>Plan</span><b>${access.plan}</b></div>${access.endsOn?`<div class="breakdown-row"><span>Access until</span><b>${shortDate(access.endsOn)}</b></div>`:''}<div class="breakdown-row"><span>Renewal</span><b>Not automatic</b></div><div class="recovery-message">Renewal reminders will offer Payhip or external renewal through support.</div>`)}${card('Your data',`<p>Export your records or request account deletion. Deletion removes live financial/profile data after confirmation; temporary backups normally expire within 30 days.</p><div class="row-actions" style="justify-content:flex-start"><button class="button-secondary" data-action="export-data">Export data</button><button class="button-ghost negative" data-action="delete-account">Delete account</button></div>`)}</div>`;
}

function labelFor(key){ return ({living:'Living Expenses',debt:'Debt',savings:'Savings',fun:'Fun'})[key]||key; }
let modalReturnFocus=null;
function openModal(config){
  const root=$('#modalRoot');modalReturnFocus=document.activeElement;
  root.innerHTML=`<div class="modal-backdrop" role="presentation"><section class="modal-panel ${config.wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><h2 id="modalTitle">${h(config.title)}</h2><p>${h(config.subtitle||'')}</p></div><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><form id="modalForm" data-form="${h(config.form)}">${config.body}<div id="modalError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">${h(config.submit||'Save')}</button></div></form></section></div>`;
  root.querySelector('input,select,button')?.focus();
}
const field=(label,name,type='text',value='',extra='',full='')=>`<div class="field ${full}"><label for="${h(name)}">${h(label)}</label><input id="${h(name)}" name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}></div>`;
const selectField=(label,name,options,full='')=>`<div class="field ${full}"><label for="${h(name)}">${h(label)}</label><select id="${h(name)}" name="${h(name)}">${options.map(o=>`<option value="${h(o[0])}">${h(o[1])}</option>`).join('')}</select></div>`;
function closeModal(){ $('#modalRoot').innerHTML='';modalReturnFocus?.focus?.();modalReturnFocus=null; }
function modalError(message){ $('#modalError').innerHTML=`<div class="warning-box">${h(message)}</div>`; }
function downloadExport(data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='debt-recovery-system-export.json';a.click();URL.revokeObjectURL(a.href);}

function actionModal(action,id){
  const type=state.page;
  if(action==='add-income') return openModal({title:'Record income received',subtitle:'This income will use the current allocation percentages.',form:'income',submit:'Review allocation',body:`<div class="form-grid">${field('Date received','date','date',TODAY,'required')}${selectField('Income source','source',[['Salary','Expected salary'],['Freelance','Freelance'],['Business','Business'],['Gift','Gift'],['Other income','Other income']])}${field('Description','description','text','','required','full')}${field('Amount','amount','number','','min="0.01" step="0.01" required','full')}</div><div class="breakdown-box">${state.allocations.map(a=>`<div class="breakdown-row"><span>${a.name} · ${a.percentage}%</span><b>Calculated after amount is entered</b></div>`).join('')}</div>`});
  if(action==='add-funds') return openModal({title:`Add funds to ${labelFor(type)}`,subtitle:'This goes only to this page and will not be auto-allocated.',form:'add-funds',body:`<div class="warning-box">To distribute income across categories, use Add Income on the Income page.</div><div class="form-grid">${field('Date','date','date',TODAY,'required')}${selectField('Source','source',[['Freelance','Freelance'],['Business','Business'],['Gift','Gift'],['Other','Other']])}${field('Amount','amount','number','','min="0.01" step="0.01" required')}${field('Note','note','text','','','full')}</div>`});
  if(action==='record-expense') return expenseModal();
  if(action==='log-expense') return expenseModal(id);
  if(action==='pay-bill'){ const b=state.bills.find(x=>x.id===id),outstanding=Math.max(b.actual-Number(b.paid||0),0); return openModal({title:`Pay ${b.name}`,subtitle:`Amount due: ${money(outstanding)}`,form:'pay-bill',body:`<input type="hidden" name="id" value="${id}"><div class="form-grid">${field('Payment date','date','date',TODAY,'required')}${field('Amount','amount','number',outstanding,'min="0.01" step="0.01" required')}</div>`}); }
  if(action==='allocate-goal'){ const g=state.goals[type].find(x=>x.id===id); return openModal({title:`Allocate to ${g.name}`,subtitle:`Available Power ${labelFor(type)}: ${money(state.funds[type])}`,form:'allocate-goal',body:`<input type="hidden" name="id" value="${id}"><div class="form-grid">${field('Date','date','date',TODAY,'required')}${field('Amount','amount','number','','min="0.01" step="0.01" required')}</div>`}); }
  if(action==='use-funds'){ const goals=state.goals[type]||[]; const options=[]; if(state.funds[type]>0)options.push(['pool',`Power ${labelFor(type)} · ${money(state.funds[type])}`]); goals.forEach(g=>options.push([g.id,`${g.name} · ${money(g.balance)}`])); return openModal({title:`Use ${labelFor(type)} funds`,subtitle:'Choose the exact source of the funds.',form:'use-funds',body:`<input type="hidden" name="preferred" value="${id||''}"><div class="form-grid">${field('Date','date','date',TODAY,'required')}${selectField('Use funds from','source',options)}${field('Amount','amount','number','','min="0.01" step="0.01" required')}${field('Purpose','note','text','','required','full')}</div>`}); }
  if(action==='new-goal') return openModal({title:`Create ${labelFor(type)} goal`,subtitle:'Choose a target, sinking fund, or continuous fund.',form:'new-goal',body:`<div class="form-grid">${field('Goal name','name','text','','required','full')}${selectField('Goal type','goalType',[['target','Target amount'],['sinking','Sinking fund'],['continuous','Continuous / no target']])}${field('Target amount','target','number','','min="0" step="0.01"')}</div>`});
  if(action==='record-payment'){ const options=state.debts.map(d=>[d.id,`${d.creditor} · ${money(d.balance)}`]); return openModal({title:'Record debt payment',subtitle:`Available Debt funds: ${money(state.funds.debt)}`,form:'debt-payment',body:`<div class="form-grid">${field('Payment date','date','date',TODAY,'required')}${selectField('Debt account','debtId',options)}${field('Payment amount','amount','number','','min="0.01" step="0.01" required')}${field('Note','note','text','','','full')}</div><div class="warning-box">Payments above the current balance are not accepted. Change the amount before saving.</div>`}); }
  if(action==='add-debt') return addDebtModal();
  if(action==='debt-history') return debtHistory(id);
  if(action==='update-debt'){
    const d=state.debts.find(x=>x.id===id); closeModal();
    return openModal({title:`Update ${d.creditor}`,subtitle:'Changes apply from the effective date and do not rewrite earlier history.',form:'update-debt',wide:true,body:`<input type="hidden" name="id" value="${id}"><div class="form-grid">${field('Effective date','date','date',TODAY,'required')}${selectField('Reason','reason',[['agreement','Agreement change'],['negotiated','Negotiated reduction'],['correction','Correction of incorrect entry']])}${field('Current balance','balance','number',d.balance,'min="0" step="0.01" required')}${field('Payment amount','payment','number',d.payment,'min="0" step="0.01" required')}${selectField('Status','status',[['Upcoming','Active / upcoming'],['Paused','Payments paused — interest may continue']])}${selectField('Interest setup','interestMode',[['none','No interest'],['included','Interest included in total'],['percentage','Separate percentage interest'],['fixed','Exact fixed interest amount']])}${selectField('Interest frequency','frequency',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']])}${field('Interest rate or fixed amount','interestValue','number',d.interestValue,'min="0" step="0.01"')}</div>`});
  }
  if(action==='archive-debt'){
    const d=state.debts.find(x=>x.id===id);
    if(!d||d.balance>.001){ closeModal(); return notice('Only a fully paid debt can be archived.',true); }
    if(window.DRS_API?.live){closeModal();window.DRS_API.request('/api/debts/archive',{method:'POST',body:JSON.stringify({debtId:id})}).then(()=>hydrateLive()).then(render).then(()=>notice(`${d.creditor} was archived as fully paid.`)).catch(error=>notice(error.message,true));return;}
    state.archivedDebts=state.archivedDebts||[]; state.archivedDebts.push(d); state.debts=state.debts.filter(x=>x.id!==id);
    addActivity('debt','archive',`Paid debt archived · ${d.creditor}`,'Closure only; no Recovery adjustment',0,TODAY); saveState(); closeModal(); render(); return notice(`${d.creditor} was archived as fully paid.`);
  }
  if(action==='move-funds') return openModal({title:'Move funds',subtitle:'Transfer existing money between categories.',form:'transfer',body:`<div class="form-grid">${field('Date','date','date',TODAY,'required')}${selectField('From category','from',state.allocations.map(a=>[a.key,`${a.name} · ${money(state.funds[a.key])}`]))}${selectField('To category','to',state.allocations.map(a=>[a.key,a.name]))}${field('Amount','amount','number','','min="0.01" step="0.01" required')}</div>`});
  if(action==='journey-details') return journeyDetails();
  if(action==='edit-recovery') return openModal({title:'Edit recovery goal',subtitle:'Journey Start and Starting Debt remain fixed.',form:'recovery-goal',body:`<div class="form-grid">${field('Target balance','targetBalance','number',state.journey.targetBalance,'min="0" step="0.01" required')}${field('Target date','targetDate','date',state.journey.targetDate,'')}</div>`});
  if(action==='allocation-settings') return allocationModal();
  if(action==='income-breakdown') return incomeBreakdown(id);
  if(action==='view-activity') return allActivity(id);
  if(action==='manage-income') return openModal({title:'Add expected income',subtitle:'Plan a future salary or other income. This does not add funds until received.',form:'expected-income',body:`<div class="form-grid">${field('Expected date','date','date',TODAY,'required')}${selectField('Source','source',[['Salary','Salary'],['Freelance','Freelance'],['Business','Business'],['Other income','Other income']])}${field('Plan name','name','text','','required')}${field('Expected amount','amount','number','','min="0.01" step="0.01" required')}</div>`});
  if(action==='receive-expected'){const item=state.expected.find(x=>x.id===id);return openModal({title:`Receive ${item.name}`,subtitle:'The actual amount will be allocated using the percentages effective on the received date.',form:'receive-expected',submit:'Receive and allocate',body:`<input type="hidden" name="id" value="${id}"><div class="form-grid">${field('Date received','date','date',TODAY,'required')}${field('Actual amount','amount','number',item.amount,'min="0.01" step="0.01" required')}</div>`});}
  if(action==='manage-bills') return openModal({title:'Add or update a bill plan',subtitle:'The bill stays due until a payment is recorded.',form:'bill-plan',body:`<div class="form-grid">${field('Bill name','name','text','','required')}${field('Monthly plan','plan','number','','min="0.01" step="0.01" required')}${field('Due day','dueDay','number','','min="1" max="31" required')}${field('Current actual amount','actual','number','','min="0" step="0.01" required')}</div>`});
  if(action==='manage-budgets') return openModal({title:'Set a monthly spending budget',subtitle:'Create or update an everyday spending category.',form:'budget-plan',body:`<div class="form-grid">${field('Budget name','name','text','','required')}${field('Monthly amount','plan','number','','min="0.01" step="0.01" required')}</div>`});
  if(action==='view-debts') return openModal({title:'All debt accounts',subtitle:`${state.debts.length} active accounts`,form:'noop',wide:true,submit:'Close',body:`<table class="debt-table"><thead><tr><th>Creditor</th><th>Status</th><th>Next due</th><th class="amount">Balance</th></tr></thead><tbody>${state.debts.map(d=>`<tr><td><span class="debt-name">${d.creditor}</span><span class="row-subtitle">${interestLabel(d)}</span></td><td>${pill(d.status,d.status==='Overdue'?'bad':'')}</td><td>${shortDate(d.dueDate)}</td><td class="amount">${money(d.balance)}</td></tr>`).join('')}</tbody></table>`});
  if(action==='milestones-all') return openModal({title:'Wins and recovery milestones',subtitle:'Only meaningful recovery progress is shown here.',form:'noop',wide:true,submit:'Close',body:`${winsHtml()}<div style="height:18px"></div>${recoveryTimeline()}`});
  if(action==='attention-all') return openModal({title:'Needs attention',subtitle:'Items requiring review before the month is settled.',form:'noop',wide:true,submit:'Close',body:`<div class="attention-grid"><div class="attention-item"><span class="attention-code">OVERDUE</span><div><span class="row-title">Credit Card A</span><span class="row-subtitle">Minimum payment remains due</span></div><span class="amount">${money(11500)}</span></div><div class="attention-item attention-separator"><span class="attention-code">ALLOCATION</span><div><span class="row-title">Debt shortfall</span><span class="row-subtitle">New funds cover the previous negative first</span></div><span class="amount">${money(3800)}</span></div></div>`});
  if(action==='export-data'){ if(window.DRS_API?.live){window.DRS_API.request('/api/account/export').then(downloadExport).catch(error=>notice(error.message,true));return;} downloadExport(state);return; }
  notice('This control is included in the Build and its detailed management view is being validated.');
}
function expenseModal(id=''){ const budget=state.budgets.find(b=>b.id===id); openModal({title:budget?`Log ${budget.name} expense`:'Record an unlisted expense',subtitle:'This reduces available Living Expenses funds.',form:'expense',body:`<input type="hidden" name="budgetId" value="${id}"><div class="form-grid">${field('Expense date','date','date',TODAY,'required')}${field('Amount','amount','number','','min="0.01" step="0.01" required')}${field('Description','description','text',budget?.name||'','required','full')}</div>`}); }
function addDebtModal(){ openModal({title:'Add debt',subtitle:'Record the current balance and agreement. You do not need to reconstruct the original debt.',form:'add-debt',wide:true,body:`<div class="form-grid">${field('Creditor / account','creditor','text','','required')}${field('Current balance','balance','number','','min="0.01" step="0.01" required')}${field('Agreement due / effective date','dueDate','date',TODAY,'required')}${field('Payment amount','payment','number','','min="0" step="0.01" required')}${selectField('Interest setup','interestMode',[['none','No interest'],['included','Interest included in total'],['percentage','Separate percentage interest'],['fixed','Exact fixed interest amount']])}${selectField('Interest frequency','frequency',[['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']])}${field('Interest rate or fixed amount','interestValue','number','0','min="0" step="0.01"')}${selectField('Payment status','status',[['Upcoming','Active / upcoming'],['Paused','Payments paused — interest may continue']])}</div><div class="warning-box">The journey uses the current balance entered here. Future agreement changes will not rewrite earlier history.</div>`}); }
function debtHistory(id){ const d=state.debts.find(x=>x.id===id),rows=activitiesFor('debt').filter(a=>a.title.includes(d.creditor)); openModal({title:d.creditor,subtitle:`Current balance ${money(d.balance)} · ${interestLabel(d)}`,form:'noop',wide:true,submit:'Close',body:`<div class="metrics">${metric('Current balance',money(d.balance))}${metric('Payment',money(d.payment))}${metric('Next due',shortDate(d.dueDate))}${metric('Status',d.status)}</div><div class="row-actions" style="justify-content:flex-start;margin:0 0 18px"><button type="button" class="button-secondary" data-action="update-debt" data-id="${d.id}">Update agreement</button>${d.balance<=.001?`<button type="button" class="button-ghost" data-action="archive-debt" data-id="${d.id}">Archive paid debt</button>`:''}</div><div class="activity-list">${rows.length?rows.map(activityRow).join(''):'<div class="empty">No account-specific history yet.</div>'}</div>`}); }
function journeyDetails(){ openModal({title:'Recovery journey details',subtitle:'Starting balances stay fixed; current balances continue to move.',form:'noop',wide:true,submit:'Close',body:`<table class="debt-table"><thead><tr><th>Debt at journey start</th><th class="amount">Starting</th><th class="amount">Current</th><th class="amount">Progress</th></tr></thead><tbody>${state.debts.map(d=>`<tr><td>${d.creditor}</td><td class="amount">${money(d.starting)}</td><td class="amount">${money(d.balance)}</td><td class="amount ${d.balance<=d.starting?'positive':'negative'}">${money(d.starting-d.balance)}</td></tr>`).join('')}</tbody></table>`}); }
function allocationModal(){ openModal({title:'Manage allocation percentages',subtitle:'Changes apply to future income only. Previous allocations will not be recalculated.',form:'allocations',body:`<div class="form-grid">${state.allocations.map(a=>field(`${a.name} percentage`,a.key,'number',a.percentage,'min="0" max="100" step="0.01" required')).join('')}</div><div class="warning-box">Allocation percentages must total exactly 100%.</div>`}); }
function incomeBreakdown(id){ const i=state.incomes.find(x=>x.id===id); openModal({title:`${i.description} allocation`,subtitle:`${shortDate(i.date)} · ${money(i.amount)}`,form:'noop',submit:'Close',body:`<div class="breakdown-box">${state.allocations.map(a=>`<div class="breakdown-row"><span>${a.name} · ${a.percentage}%</span><b>${money(i.amount*a.percentage/100)}</b></div>`).join('')}<div class="breakdown-row total"><span>Total</span><b>${money(i.amount)}</b></div></div>`}); }
function allActivity(category=''){ const rows=activitiesFor(category); openModal({title:`${category?labelFor(category)+' ':''}Activity`,subtitle:'Complete chronological history.',form:'noop',wide:true,submit:'Close',body:`<div class="activity-list">${rows.map(activityRow).join('')}</div>`}); }

async function submitForm(form){
  const data=Object.fromEntries(new FormData(form).entries()), kind=form.dataset.form;
  if(kind==='noop'){ closeModal(); return; }
  if(window.DRS_API?.live){try{await window.DRS_API.persist(kind,data,state.page);await hydrateLive();closeModal();render();notice('Saved. The activity and balances were updated.');}catch(error){modalError(error.message);}return;}
  if(kind==='income'){
    const amount=Number(data.amount), income={id:uid('i'),date:data.date,source:data.source,description:data.description,amount,allocated:true}; state.incomes.unshift(income); addActivity('income','income',`${data.description} received`,'Allocation breakdown recorded',amount,data.date);
    state.allocations.forEach(a=>{ const allocated=amount*a.percentage/100; state.funds[a.key]+=allocated; addActivity(a.key,'allocation','Income allocation received',`${data.description} · ${a.percentage}%`,allocated,data.date); });
    saveState(); closeModal(); render(); incomeBreakdown(income.id); return;
  }
  if(kind==='add-funds'){ const amount=Number(data.amount),type=state.page; state.funds[type]+=amount; addActivity(type,'funds',`Direct funds added to ${labelFor(type)}`,`${data.source}${data.note?' · '+data.note:''} · not auto-allocated`,amount,data.date); }
  if(kind==='expense'){ const amount=Number(data.amount); if(amount>state.funds.living)return modalError(`Only ${money(state.funds.living)} is available in Living Expenses.`); state.funds.living-=amount; const b=state.budgets.find(x=>x.id===data.budgetId); if(b)b.spent+=amount; addActivity('living','expense',`${data.description} expense recorded`,b?'Monthly spending':'Unlisted expense',-amount,data.date); }
  if(kind==='pay-bill'){ const b=state.bills.find(x=>x.id===data.id),amount=Number(data.amount),outstanding=Math.max(b.actual-Number(b.paid||0),0); if(amount>outstanding)return modalError(`The bill requires ${money(outstanding)}. Change the amount to avoid an excess payment.`); if(amount>state.funds.living)return modalError(`Only ${money(state.funds.living)} is available.`); state.funds.living-=amount;b.paid=Number(b.paid||0)+amount;b.status=b.paid>=b.actual?'Paid':'Partially paid'; addActivity('living','bill',`${b.name} bill paid`,'Bill payment',-amount,data.date); }
  if(kind==='allocate-goal'){ const type=state.page,g=state.goals[type].find(x=>x.id===data.id),amount=Number(data.amount); if(amount>state.funds[type])return modalError(`Only ${money(state.funds[type])} is available in Power ${labelFor(type)}.`); state.funds[type]-=amount; g.balance+=amount; addActivity(type,'goal',`Added to ${g.name}`,'From available funds',amount,data.date); }
  if(kind==='use-funds'){ const type=state.page,amount=Number(data.amount); if(data.source==='pool'){ if(amount>state.funds[type])return modalError(`Only ${money(state.funds[type])} is available.`); state.funds[type]-=amount; } else { const g=state.goals[type].find(x=>x.id===data.source); if(amount>g.balance)return modalError(`Only ${money(g.balance)} is available in ${g.name}.`); g.balance-=amount; } addActivity(type,'withdrawal','Funds used',`${data.note} · from ${data.source==='pool'?`Power ${labelFor(type)}`:state.goals[type].find(x=>x.id===data.source).name}`,-amount,data.date); }
  if(kind==='new-goal'){ state.goals[state.page].push({id:uid('g'),name:data.name,type:data.goalType,target:data.goalType==='continuous'?0:Number(data.target||0),balance:0}); addActivity(state.page,'goal','New goal created',data.name,0,TODAY); }
  if(kind==='debt-payment'){ const d=state.debts.find(x=>x.id===data.debtId),amount=Number(data.amount); if(amount>d.balance)return modalError(`This payment exceeds the current balance of ${money(d.balance)}. Change the amount before saving.`); if(amount>state.funds.debt)return modalError(`Only ${money(state.funds.debt)} is available in Debt funds.`); d.balance-=amount; state.funds.debt-=amount; addActivity('debt','payment',`Payment made · ${d.creditor}`,data.note||'Interest first, then principal',-amount,data.date); if(d.balance<=.001){d.status='Paid';addActivity('debt','cleared',`Debt cleared · ${d.creditor}`,'Account fully paid',0,data.date);} }
  if(kind==='add-debt'){ const balance=Number(data.balance),d={id:uid('d'),creditor:data.creditor,balance,starting:balance,payment:Number(data.payment),dueDate:data.dueDate,status:data.status,interestMode:data.interestMode,interestValue:Number(data.interestValue),interestFrequency:data.frequency,paused:data.status==='Paused',created:TODAY}; state.debts.push(d); state.recoveryPoints.push({date:TODAY,balance:currentDebt()}); state.journey.noNewDebtSince=TODAY; addActivity('debt','new-debt',`New debt added · ${d.creditor}`,'Recorded current balance',balance,TODAY); }
  if(kind==='update-debt'){
    const d=state.debts.find(x=>x.id===data.id),oldBalance=d.balance,newBalance=Number(data.balance),difference=newBalance-oldBalance;
    d.balance=newBalance; d.payment=Number(data.payment); d.status=data.status; d.paused=data.status==='Paused'; d.interestMode=data.interestMode; d.interestFrequency=data.frequency; d.interestValue=Number(data.interestValue);
    const type=data.reason==='negotiated'?'negotiated':data.reason==='correction'?'correction':'agreement';
    const title=data.reason==='negotiated'?`Negotiated balance · ${d.creditor}`:data.reason==='correction'?`Balance correction · ${d.creditor}`:`Agreement updated · ${d.creditor}`;
    addActivity('debt',type,title,data.reason==='negotiated'?`Formal balance reduction of ${money(Math.max(oldBalance-newBalance,0))}`:'Applied prospectively; earlier history unchanged',difference,data.date);
    state.recoveryPoints.push({date:data.date,balance:currentDebt()});
  }
  if(kind==='transfer'){ const amount=Number(data.amount); if(data.from===data.to)return modalError('Choose two different categories.'); if(amount>state.funds[data.from])return modalError(`Only ${money(state.funds[data.from])} is available in ${labelFor(data.from)}.`); state.funds[data.from]-=amount; state.funds[data.to]+=amount; state.transfers.push({id:uid('t'),date:data.date,from:data.from,to:data.to,amount}); addActivity(data.from,'transfer',`Funds moved to ${labelFor(data.to)}`,`Transfer from ${labelFor(data.from)}`,-amount,data.date); addActivity(data.to,'transfer',`Funds received from ${labelFor(data.from)}`,`Transfer to ${labelFor(data.to)}`,amount,data.date); }
  if(kind==='allocations'){ const vals=state.allocations.map(a=>Number(data[a.key])),total=vals.reduce((a,b)=>a+b,0); if(Math.abs(total-100)>.001)return modalError(`Percentages currently total ${total}%. They must total exactly 100%.`); state.allocations.forEach((a,i)=>a.percentage=vals[i]); }
  if(kind==='expected-income'){ state.expected.push({id:uid('e'),date:data.date,name:data.name,source:data.source,amount:Number(data.amount),status:'Expected'}); }
  if(kind==='receive-expected'){const item=state.expected.find(x=>x.id===data.id),amount=Number(data.amount);item.status='Received';item.amount=amount;state.incomes.unshift({id:uid('i'),date:data.date,source:item.source,description:item.name,amount,allocated:true});state.allocations.forEach(a=>{const allocated=amount*a.percentage/100;state.funds[a.key]+=allocated;addActivity(a.key,'allocation','Income allocation received',`${item.name} · ${a.percentage}%`,allocated,data.date);});addActivity('income','income',`${item.name} received`,'Expected income finalized and allocated',amount,data.date);}
  if(kind==='bill-plan'){
    const existing=state.bills.find(b=>b.name.toLowerCase()===data.name.toLowerCase());
    if(existing)Object.assign(existing,{plan:Number(data.plan),actual:Number(data.actual),dueDay:Number(data.dueDay),status:Number(data.actual)>Number(data.plan)?'Needs review':'Upcoming'});
    else state.bills.push({id:uid('b'),name:data.name,plan:Number(data.plan),actual:Number(data.actual),dueDay:Number(data.dueDay),status:Number(data.actual)>Number(data.plan)?'Needs review':'Upcoming'});
  }
  if(kind==='budget-plan'){
    const existing=state.budgets.find(b=>b.name.toLowerCase()===data.name.toLowerCase());
    if(existing)existing.plan=Number(data.plan); else state.budgets.push({id:uid('m'),name:data.name,plan:Number(data.plan),spent:0});
  }
  if(kind==='recovery-goal'){ state.journey.targetBalance=Number(data.targetBalance); state.journey.targetDate=data.targetDate; }
  saveState(); closeModal(); render(); notice('Saved. The activity and balances were updated.');
}

document.addEventListener('click',event=>{
  const page=event.target.closest('[data-page]')?.dataset.page; if(page)return go(page);
  const target=event.target.closest('[data-action]'); if(!target)return;
  const action=target.dataset.action,id=target.dataset.id||target.dataset.category||'';
  if(action==='close-modal')return closeModal();
  if(action==='delete-account'){if(!window.DRS_API?.live)return notice('Account deletion is disabled in the local visual-review build.',true);return openModal({title:'Delete account and financial data',subtitle:'This removes live financial and profile data. Required payment and operational records follow the disclosed retention rules.',form:'delete-account',submit:'Delete account',body:`<div class="warning-box">Temporary backup copies may remain until backup expiry, normally within 30 days.</div><div class="form-grid">${field('Type DELETE to confirm','confirmation','text','','required pattern="DELETE"','full')}</div>`});}
  actionModal(action,id);
});
document.addEventListener('submit',event=>{ if(event.target.id==='modalForm'){event.preventDefault();submitForm(event.target);} });
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
document.addEventListener('keydown',event=>{if(event.key==='Escape')return closeModal();if(event.key==='Tab'&&$('#modalRoot').innerHTML){const items=[...$('#modalRoot').querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
async function hydrateLive(){const patch=await window.DRS_API?.bootstrap();if(patch){Object.keys(patch).forEach(key=>{if(patch[key]!==undefined)state[key]=patch[key];});}}
render();
if(window.DRS_API?.live)hydrateLive().then(render).catch(error=>notice(error.message,true));
window.addEventListener('drs-authenticated',()=>hydrateLive().then(render).catch(error=>notice(error.message,true)));
