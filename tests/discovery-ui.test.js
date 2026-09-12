const fs=require('fs');
const js=fs.readFileSync('script.js','utf8');
const css=fs.readFileSync('discovery-assistant.css','utf8');
const checks=[
 ['Stripe CTA class',/v2-da-primary v2-da-pay/.test(js)],
 ['Stripe CTA accent text',/\.v2-da-pay[^}]*color:#ffd34e!important/.test(css)],
 ['Stripe visited state covered',/\.v2-da-pay:visited/.test(css)],
 ['confirmation card renderer',/function addConfirmationCard\(slot\)/.test(js)],
 ['fallback uses confirmation card',/addConfirmationCard\(slot\)/.test(js)],
 ['confirmation card styling',/\.v2-da-confirmation\{/.test(css)],
 ['confirmation status copy',/Awaiting final Calendar confirmation/.test(js)]
];
let failed=false;for(const [name,ok] of checks){console.log((ok?'PASS: ':'FAIL: ')+name);if(!ok)failed=true;}if(failed)process.exit(1);
