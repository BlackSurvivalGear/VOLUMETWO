import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth=getAuth(app),db=getFirestore(app);
let hasPro=false;
const allowed=(profile)=>profile?.plan==='pro'||['pro','admin','superadmin'].includes(profile?.role);
const goUpgrade=()=>{window.location.href='upgrade.html?return=business-tools.html';};
const guard=(event)=>{if(hasPro)return;event.preventDefault();event.stopImmediatePropagation();goUpgrade();};

// Capture generation/output actions while leaving every form field and live preview usable.
document.querySelector('#invoice-form')?.addEventListener('submit',guard,true);
document.querySelector('#print-invoice')?.addEventListener('click',guard,true);
document.querySelector('#qr-form')?.addEventListener('submit',guard,true);
document.querySelector('#qr-download')?.addEventListener('click',guard,true);

onAuthStateChanged(auth,async(user)=>{
 if(!user)return;
 try{const snap=await getDoc(doc(db,'users',user.uid));hasPro=allowed(snap.exists()?snap.data():{});}catch(_){hasPro=false;}
 document.body.dataset.proAccess=hasPro?'true':'false';
 document.querySelectorAll('[data-pro-status]').forEach(el=>{el.textContent=hasPro?'PRO':'FREE';});
});
