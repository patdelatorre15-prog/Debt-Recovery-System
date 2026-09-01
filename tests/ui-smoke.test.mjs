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
