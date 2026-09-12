const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');

const checks = [
  ['LockService', /LockService\.getScriptLock\(\)/],
  ['server-side overlap recheck', /calendar\.getEvents\(start, end\)/],
  ['30 minute validation', /CONFIG\.SLOT_MINUTES \* 60000/],
  ['attendee invitation', /sendInvites:\s*true/],
  ['internal notification', /CONFIG\.INTERNAL_EMAIL/],
  ['PayPal sandbox/live API', /api-m\.sandbox\.paypal\.com/],
  ['server-controlled £95 GBP amount', /DISCOVERY_PRICE:\s*'95\.00'[\s\S]*CURRENCY:\s*'GBP'/],
  ['payment required for booking', /verifyPayment_\(body\.paymentOrderId, body\.email\)/],
  ['completed payment verification', /payment\.status !== 'COMPLETED'/],
  ['payment single use', /payment\.bookingId/],
  ['business hours enforcement', /Invalid booking window/]
];
let failed = false;
for (const [name, pattern] of checks) {
  if (!pattern.test(code)) { console.error('FAIL:', name); failed = true; }
  else console.log('PASS:', name);
}
if (failed) process.exit(1);
