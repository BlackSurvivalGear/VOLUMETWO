const fs=require('fs');
const paywall=fs.readFileSync('pro-paywall.js','utf8');
const upgrade=fs.readFileSync('upgrade.html','utf8');
const backend=fs.readFileSync('apps-script/ProPaywall.gs','utf8');
const manifest=fs.readFileSync('apps-script/appsscript.json','utf8');
const tools=fs.readFileSync('business-tools.html','utf8');
const checks=[
 ['action guard wired',tools.includes('src="pro-paywall.js"')],
 ['free users redirect only on protected actions',paywall.includes("event.preventDefault()")&&paywall.includes("upgrade.html?return=business-tools.html"))],
 ['lifetime offer',upgrade.includes('LIFETIME ACCESS')&&upgrade.includes('£19.99')),
 ['Stripe amount is 1999 pence',backend.includes('PRICE_PENCE: 1999')),
 ['server verifies paid status',backend.includes("session.payment_status!=='paid'"))],
 ['server verifies UID',backend.includes('session.client_reference_id')&&backend.includes('pending.uid')),
 ['server verifies Firestore email',backend.includes("firestoreString_(user,'email')"))],
 ['server grants plan pro',backend.includes("plan:{stringValue:'pro'}"))],
 ['returns directly to Business Tools',backend.includes("business-tools.html?pro=success"))],
 ['Firestore OAuth scope',manifest.includes('https://www.googleapis.com/auth/datastore'))
];
let failed=false;for(const [name,ok] of checks){console.log((ok?'PASS: ':'FAIL: ')+name);if(!ok)failed=true;}if(failed)process.exit(1);
