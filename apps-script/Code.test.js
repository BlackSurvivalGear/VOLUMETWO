const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');
const frontend = fs.readFileSync('../script.js', 'utf8');

const checks = [
  ['LockService', code, /LockService\.getScriptLock\(\)/],
  ['server-side overlap recheck', code, /calendar\.getEvents\(start, end\)/],
  ['30 minute validation', code, /CONFIG\.SLOT_MINUTES \* 60000/],
  ['attendee invitation', code, /sendInvites:\s*true/],
  ['internal notification', code, /CONFIG\.INTERNAL_EMAIL/],
  ['PayPal sandbox/live API', code, /api-m\.sandbox\.paypal\.com/],
  ['server-controlled £95 GBP amount', code, /DISCOVERY_PRICE:\s*'95\.00'[\s\S]*CURRENCY:\s*'GBP'/],
  ['payment required for booking', code, /verifyPayment_\(body\.paymentOrderId, body\.email\)/],
  ['completed payment verification', code, /payment\.status !== 'COMPLETED'/],
  ['payment single use', code, /payment\.bookingId/],
  ['business hours enforcement', code, /Invalid booking window/],
  ['deployed Apps Script endpoint', frontend, /AKfycbzE9dEcI1JIZLwNFkULE2qLwXlr72xs_PQ5nHRBi71mYHRQqvQDKaw9qsRLpTHaRlJe\/exec/],
  ['PayPal checkout action', frontend, /action=pay&email=/],
  ['PayPal return contract', frontend, /payment'\)===['"]success['"][\s\S]*returned\.get\(['"]order['"]\)/],
  ['payment order sent to booking endpoint', frontend, /paymentOrderId:state\.paymentOrderId/]
];
let failed = false;
for (const [name, source, pattern] of checks) {
  if (!pattern.test(source)) { console.error('FAIL:', name); failed = true; }
  else console.log('PASS:', name);
}
if (failed) process.exit(1);
