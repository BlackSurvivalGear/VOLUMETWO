const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');
const frontend = fs.readFileSync('../script.js', 'utf8');
const pro = fs.readFileSync('ProPaywall.gs', 'utf8');

const checks = [
  ['LockService', code, /LockService\.getScriptLock\(\)/],
  ['server-side overlap recheck', code, /calendar\.getEvents\(start, end\)/],
  ['30 minute validation', code, /CONFIG\.SLOT_MINUTES \* 60000/],
  ['attendee invitation', code, /sendInvites:\s*true/],
  ['internal notification', code, /CONFIG\.INTERNAL_EMAIL/],
  ['booking requires no payment token', code, /paymentOrderId/, true],
  ['discovery Stripe checkout route removed', code, /action === 'pay'/, true],
  ['discovery Stripe return route removed', code, /stripe-return/, true],
  ['frontend payment CTA removed', frontend, /Pay £95|action=pay&email=|paymentOrderId/, true],
  ['frontend free booking copy', frontend, /no payment required/i],
  ['multi-select challenge', frontend, /key:'challenge'[\s\S]*multiple:true/],
  ['multi-select help', frontend, /key:'help'[\s\S]*multiple:true/],
  ['multi-select answers sent as arrays', frontend, /answer\(\[\.\.\.selected\]\)/],
  ['multi-select arrays preserved in booking details', code, /cleanList_\(body\.challenge\)[\s\S]*cleanList_\(body\.help\)/],
  ['business hours enforcement', code, /Invalid booking window/],
  ['Volume Two Apps Script endpoint', frontend, /AKfycbywjKhNANdIfqVdWViq9WnF2o4UP7fIGWU-OqfSdm8mwg5mjkMDZ1mQaY_kEL36tt8rSA\/exec/],
  ['shared Stripe transport retained for Pro', code, /function stripeRequest_/,],
  ['Pro checkout still uses Stripe', pro, /startProCheckout_[\s\S]*stripeRequest_/],
  ['Pro price remains £19.99', pro, /PRICE_PENCE:\s*1999/],
  ['no PayPal API remains', code, /paypal/i, true]
];

let failed = false;
for (const [name, source, pattern, mustNotMatch = false] of checks) {
  const matched = pattern.test(source);
  const ok = mustNotMatch ? !matched : matched;
  if (!ok) { console.error('FAIL:', name); failed = true; }
  else console.log('PASS:', name);
}
if (failed) process.exit(1);
