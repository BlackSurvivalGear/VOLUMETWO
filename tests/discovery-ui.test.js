const fs=require('fs');
const js=fs.readFileSync('script.js','utf8');
const checks=[
 ['no discovery payment CTA',!/Pay £95|action=pay&email=|paymentOrderId/.test(js)],
 ['free booking copy',/no payment required/i.test(js)],
 ['challenge supports multi-select',/key:'challenge'[\s\S]*multiple:true/.test(js)],
 ['help supports multi-select',/key:'help'[\s\S]*multiple:true/.test(js)],
 ['multi-select uses aria-pressed',/setAttribute\('aria-pressed'/.test(js)],
 ['multi-select has Continue action',/continueButton\.textContent='Continue'/.test(js)],
 ['selected answers submitted together',/answer\(\[\.\.\.selected\]\)/.test(js)],
 ['confirmation card renderer',/function addConfirmationCard\(slot\)/.test(js)],
 ['confirmation removes payment requirement',/No payment is required/.test(js)],
 ['calendar booking still available',/function loadSlots\(\)/.test(js)&&/action:'book'/.test(js)]
];
let failed=false;for(const [name,ok] of checks){console.log((ok?'PASS: ':'FAIL: ')+name);if(!ok)failed=true;}if(failed)process.exit(1);
