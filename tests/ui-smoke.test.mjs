import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('every approved user page renders without a runtime error',()=>{
  const nodes=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return null;},focus(){}});return nodes.get(selector);};
  const context={console,Date,Intl,Math,JSON,Number,String,Array,Object,Blob,URL,crypto,FormData:class{},localStorage:{getItem(){return null;},setItem(){}},document:{querySelector:node,addEventListener(){},createElement(){return {click(){}};}},window:{DRS_API:{live:false},scrollTo(){},addEventListener(){}},setTimeout,clearTimeout};
  vm.createContext(context);
  const source=readFileSync(new URL('../script.js',import.meta.url),'utf8')+'\n;globalThis.__test={state,render,activityRow,openModal};';
  vm.runInContext(source,context);
  for(const page of ['dashboard','income','living','savings','fun','debt','actions','recovery','account']){
    context.__test.state.page=page;context.__test.render();
    assert.ok(node('#pageTitle').textContent,`${page} title`);
    assert.ok(node('#app').innerHTML.length>200,`${page} content`);
  }
  context.__test.state.activities.unshift({id:'x',date:'2026-08-30',category:'debt',type:'interest',title:'<img src=x onerror=alert(1)>',detail:'<script>alert(1)</script>',amount:1});
  const rendered=context.__test.activityRow(context.__test.state.activities[0]);
  assert.equal(rendered.includes('<script>'),false,'activity text is escaped');
  assert.equal(rendered.includes('<img src='),false,'activity title is escaped');
  context.__test.openModal({title:'<img src=x>',subtitle:'<script>x</script>',form:'noop',body:''});
  assert.equal(node('#modalRoot').innerHTML.includes('<script>'),false,'modal heading text is escaped');
});

test('responsive and accessibility foundations are present',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),script=readFileSync(new URL('../script.js',import.meta.url),'utf8');
  assert.match(html,/aria-label="Primary navigation"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(css,/@media \(max-width: 760px\)/);
  assert.match(script,/aria-current="page"/);
  assert.match(script,/role="dialog" aria-modal="true"/);
  assert.match(script,/event\.key==='Escape'/);
});

test('Cycle 1 workflows are present without legacy demo fallbacks',()=>{
  const script=readFileSync(new URL('../script.js',import.meta.url),'utf8'),api=readFileSync(new URL('../api-client.js',import.meta.url),'utf8'),admin=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  assert.match(script,/Review income allocation/);
  assert.match(script,/Manage Monthly Spending/);
  assert.match(script,/Manage Bills/);
  assert.match(script,/function attentionItems\(\)/);
  assert.match(script,/id="moveForm"/);
  assert.match(script,/data-action="logout"/);
  assert.doesNotMatch(script,/Credit Card A/);
  assert.doesNotMatch(script,/62513\.8/);
  assert.match(api,/expected-income\/update/);
  assert.match(api,/living-plans\/bulk/);
  assert.match(admin,/class="admin-pending"/);
});

test('Living management and ledger reversal controls are present',()=>{
  const script=readFileSync(new URL('../script.js',import.meta.url),'utf8'),api=readFileSync(new URL('../api-client.js',import.meta.url),'utf8');
  assert.match(script,/Manage Monthly Spending/);
  assert.match(script,/Manage Bills/);
  assert.match(script,/Planned amount/);
  assert.match(script,/Actual amount/);
  assert.match(script,/Paid amount/);
  assert.match(script,/This payment settles the bill in full/);
  assert.match(script,/Twice a month/);
  assert.match(script,/Required note/);
  assert.match(api,/ledger\/reverse/);
});

test('today findings are represented in debt, activity, fund, and recovery layouts',()=>{
  const script=readFileSync(new URL('../script.js',import.meta.url),'utf8'),api=readFileSync(new URL('../api-client.js',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(script,/Due Today/);
  assert.match(script,/debtFilterLabel/);
  assert.match(script,/Expected income plan/);
  assert.match(script,/expectedIncomeId/);
  assert.match(script,/total ·.*active ·.*paid/);
  assert.match(script,/Remaining due/);
  assert.match(script,/active debt already uses this creditor \/ agreement name/i);
  assert.match(api,/dueDate:data\.dueDate/);
  assert.match(api,/duplicate_debt_account/);
  assert.match(css,/\.funds-metrics \{ grid-template-columns:repeat\(3/);
  assert.match(css,/\.dashboard-recovery-grid \.recovery-hero/);
  assert.match(css,/\.debt-filters/);
  assert.match(css,/\.debt-accounts-table/);
});

test('approved dashboard and Income page layouts are rendered',()=>{
  const nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return null;},focus(){}});return nodes.get(selector);};
  const context={console,Date,Intl,Math,JSON,Number,String,Array,Object,Blob,URL,crypto,FormData:class{},localStorage:{getItem(){return null;},setItem(){}},document:{querySelector:node,addEventListener(){},createElement(){return {click(){}};}},window:{DRS_API:{live:false},scrollTo(){},addEventListener(){}},setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../script.js',import.meta.url),'utf8')+'\n;globalThis.__test={state,render};',context);
  context.__test.state.page='dashboard';context.__test.render();let output=node('#app').innerHTML;
  assert.doesNotMatch(output,/Monthly allocation/);
  assert.match(output,/grid-2 dashboard-recovery-grid/);
  assert.ok(output.indexOf('Recovery snapshot')<output.indexOf('Wins &amp; milestones'));
  context.__test.state.page='income';context.__test.render();output=node('#app').innerHTML;
  assert.match(output,/class="income-hero"/);
  assert.match(output,/Recovery Allocation/);
  assert.match(output,/expected-income-list/);
  assert.match(output,/grid-2 income-lower/);
});
