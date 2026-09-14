const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const sent=[];
const cache=new Map();
const sandbox={
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  CacheService:{getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value)})},
  Utilities:{getUuid:()=> '12345678-abcd',base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),formatDate:()=> 'Monday 14 September 2026, 12:00'},
  MailApp:{sendEmail:(...args)=>sent.push(args)},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this}})},
  console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),sandbox);

function request(changes={}) {
  const body={action:'discoveryRequest',name:'Ada Mensah',email:'ada@example.com',challenge:['Brand positioning','Marketing strategy'],outcome:['A stronger brand'],timing:'This quarter',website:'',...changes};
  return JSON.parse(sandbox.doPost({postData:{contents:JSON.stringify(body)}}).text);
}

const result=request();
assert.equal(result.ok,true);
assert.equal(result.enquiry.id,'V2-12345678');
assert.equal(sent.length,2);
assert.equal(sent[0][0],'info@volumetwo.co.uk');
assert.equal(sent[1][0],'ada@example.com');
assert.match(sent[0][2],/Brand positioning, Marketing strategy/);
assert.match(sent[1][2],/No payment is required/);

const duplicate=request();
assert.equal(duplicate.ok,false);
assert.match(duplicate.error,/already sent recently/);

const invalid=request({email:'not-an-email'});
assert.equal(invalid.ok,false);
assert.equal(sent.length,2);

console.log('Apps Script discovery email tests passed');
