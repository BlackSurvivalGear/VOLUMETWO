// Lightweight validation tests for the pure input rules mirrored from Code.gs.
// Run with: node apps-script/Code.test.js
const assert = require('assert');
const SLOT_MINUTES = 30;
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validSlot(start,end){ const s=new Date(start),e=new Date(end); return !isNaN(s)&&!isNaN(e)&&e>s&&(e-s)===SLOT_MINUTES*60000; }
assert.equal(validEmail('lead@example.com'),true);
assert.equal(validEmail('bad-email'),false);
assert.equal(validSlot('2026-09-14T09:00:00Z','2026-09-14T09:30:00Z'),true);
assert.equal(validSlot('2026-09-14T09:00:00Z','2026-09-14T10:00:00Z'),false);
assert.equal(validSlot('invalid','2026-09-14T10:00:00Z'),false);
console.log('Calendar booking validation tests passed');
