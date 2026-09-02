import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateMinor,calculateRecovery,addMonths,daysBetween,isInterestCycleDue,dueInterestCycles,normalizePaymentEvent,normalizePayhipEvent,normalizePayPalEvent,parseProductMap,verifyPayhipWebhook} from '../worker/src/index.js';

test('allocation preserves every cent and historical rule percentages',()=>{
  const rule={living_percentage:40,debt_percentage:55,savings_percentage:4,fun_percentage:1};
  const result=allocateMinor(5000001,rule);
  assert.equal(Object.values(result).reduce((a,b)=>a+b,0),5000001);
  assert.deepEqual(result,{living:2000000,debt:2750001,savings:200000,fun:50000});
});

test('plan duration handles end-of-month dates',()=>{
  assert.equal(addMonths('2026-01-31',3),'2026-04-30');
  assert.equal(addMonths('2026-08-31',6),'2027-02-28');
});

test('daily weekly and monthly interest follow the agreement due date',()=>{
  assert.equal(isInterestCycleDue({due_date:'2026-08-31',interest_frequency:'daily'},'2026-09-01'),true);
  assert.equal(isInterestCycleDue({due_date:'2026-08-31',interest_frequency:'weekly'},'2026-09-07'),true);
  assert.equal(isInterestCycleDue({due_date:'2026-01-31',interest_frequency:'monthly'},'2026-02-28'),true);
  assert.equal(isInterestCycleDue({due_date:'2026-01-31',interest_frequency:'monthly'},'2026-02-27'),false);
});

test('normalized payment events reject unknown event types',()=>{
  assert.equal(normalizePaymentEvent({provider:'payhip',type:'unknown',eventId:'e',transactionId:'t',email:'a@b.com'}),null);
  assert.equal(normalizePaymentEvent({provider:'payhip',type:'payment_completed',eventId:'e',transactionId:'t',email:'A@B.com',plan:'3months',amount:199}).email,'a@b.com');
});

test('day difference is deterministic',()=>assert.equal(daysBetween('2026-08-01','2026-08-31'),30));

test('negotiation counts as recovery while a correction stays neutral',()=>{
  assert.equal(calculateRecovery(10000000,8000000,0,0).recoveredMinor,2000000);
  assert.equal(calculateRecovery(10000000,8000000,0,-2000000).recoveredMinor,0);
});

test('missed scheduled interest cycles are caught up in a bounded batch',()=>{
  const agreement={due_date:'2026-08-01',effective_on:'2026-08-01',interest_frequency:'weekly'};
  assert.deepEqual(dueInterestCycles(agreement,'2026-08-08','2026-08-31',3),['2026-08-15','2026-08-22','2026-08-29']);
  assert.deepEqual(dueInterestCycles({due_date:'2026-01-31',effective_on:'2026-01-01',interest_frequency:'monthly'},'2026-02-28','2026-04-30',3),['2026-03-31','2026-04-30']);
});

test('Payhip events are mapped from official webhook fields and cents are preserved',()=>{
  const paid=normalizePayhipEvent({id:'sale-1',email:'buyer@example.com',currency:'PHP',price:19900,date:1788220800,type:'paid',items:[{product_id:'p3'}]},{p3:'3months'});
  assert.deepEqual({...paid,licenseKey:''},{provider:'payhip',type:'payment_completed',eventId:'paid:sale-1:1788220800',transactionId:'sale-1',email:'buyer@example.com',plan:'3months',licenseKey:'',amountMinor:19900,currency:'PHP'});
  const refund=normalizePayhipEvent({id:'sale-1',email:'buyer@example.com',currency:'PHP',price:19900,amount_refunded:19900,date_refunded:1788307200,type:'refunded',items:[{product_id:'p3'}]},{p3:'3months'});
  assert.equal(refund.type,'refund');assert.equal(refund.transactionId,'sale-1');assert.equal(refund.amountMinor,19900);
});

test('Payhip signature is the SHA-256 hash of the API key',async()=>{
  const key='payhip-development-api-key';
  const signature=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  assert.equal(await verifyPayhipWebhook({signature},key),true);
  assert.equal(await verifyPayhipWebhook({signature:'tampered'},key),false);
});

test('PayPal captures, disputes and product maps normalize deterministically',()=>{
  assert.deepEqual(parseProductMap('{"ORDER-3":"3months"}'),{'ORDER-3':'3months'});
  const capture=normalizePayPalEvent({id:'WH-1',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAP-1',custom_id:'ORDER-3',amount:{value:'199.00',currency_code:'PHP'},payer:{email_address:'buyer@example.com'}}},{'ORDER-3':'3months'});
  assert.equal(capture.type,'payment_completed');assert.equal(capture.transactionId,'CAP-1');assert.equal(capture.plan,'3months');assert.equal(capture.amountMinor,19900);
  const dispute=normalizePayPalEvent({id:'WH-2',event_type:'CUSTOMER.DISPUTE.RESOLVED',resource:{dispute_outcome:{outcome_code:'RESOLVED_SELLER_FAVOR'},disputed_transactions:[{seller_transaction_id:'CAP-1',buyer:{email_address:'buyer@example.com'}}],dispute_amount:{value:'199.00',currency_code:'PHP'}}},{});
  assert.equal(dispute.type,'dispute_resolved_won');assert.equal(dispute.transactionId,'CAP-1');
});
