const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');
const frontend = fs.readFileSync('../script.js', 'utf8');

const checks = [
  ['LockService', code, /LockService\.getScriptLock\(\)/],
  ['server-side overlap recheck', code, /calendar\.getEvents\(start, end\)/],
  ['30 minute validation', code, /CONFIG\.SLOT_MINUTES \* 60000/],
  ['attendee invitation', code, /sendInvites:\s*true/],
  ['internal notification', code, /CONFIG\.INTERNAL_EMAIL/],
  ['Stripe API endpoint', code, /https:\/\/api\.stripe\.com/],
  ['Stripe secret stored in Script Properties', code, /getProperty\('STRIPE_SECRET_KEY'\)/],
  ['server-controlled £95 GBP amount', code, /DISCOVERY_PRICE:\s*'95\.00'[\s\S]*DISCOVERY_PRICE_PENCE:\s*9500[\s\S]*CURRENCY:\s*'GBP'/],
  ['Stripe checkout session', code, /startStripeCheckout_[\s\S]*\/v1\/checkout\/sessions/],
  ['guest card checkout copy', frontend, /No Stripe account is required/],
  ['payment required for booking', code, /verifyPayment_\(body\.paymentOrderId,\s*body\.email\)/],
  ['Stripe paid status verification', code, /session\.payment_status !== 'paid'/],
  ['Stripe amount verification', code, /Number\(session\.amount_total\) !== CONFIG\.DISCOVERY_PRICE_PENCE/],
  ['Stripe currency verification', code, /String\(session\.currency \|\| ''\)\.toUpperCase\(\) !== CONFIG\.CURRENCY/],
  ['payment email binding', code, /client_reference_id[\s\S]*booking email/],
  ['payment single use', code, /payment\.bookingId/],
  ['business hours enforcement', code, /Invalid booking window/],
  ['Volume Two Apps Script endpoint', frontend, /AKfycbywjKhNANdIfqVdWViq9WnF2o4UP7fIGWU-OqfSdm8mwg5mjkMDZ1mQaY_kEL36tt8rSA\/exec/],
  ['old Apps Script endpoint removed', frontend, /AKfycbzE9dEcI1JIZLwNFkULE2qLwXlr72xs_PQ5nHRBi71mYHRQqvQDKaw9qsRLpTHaRlJe\/exec/, true],
  ['checkout action', frontend, /action=pay&email=/],
  ['Stripe return route', code, /action === 'stripe-return'/],
  ['payment return contract', frontend, /payment'\)===['"]success['"][\s\S]*returned\.get\(['"]order['"]\)/],
  ['payment order sent to booking endpoint', frontend, /paymentOrderId:state\.paymentOrderId/],
  ['Apps Script top-level navigation', code, /<base target=\"_top\">/],
  ['secure continue link targets top frame', code, /target=\"_top\"[\s\S]*Continue securely/],
  ['no automatic location.replace redirect', code, /location\.replace\(/, true],
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
