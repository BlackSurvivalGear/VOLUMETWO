import { getAuth,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";
const auth=getAuth(app);
const API='https://script.google.com/macros/s/AKfycbywjKhNANdIfqVdWViq9WnF2o4UP7fIGWU-OqfSdm8mwg5mjkMDZ1mQaY_kEL36tt8rSA/exec';
const button=document.querySelector('#upgrade-pro'),status=document.querySelector('#upgrade-status');
const params=new URLSearchParams(location.search);
onAuthStateChanged(auth,(user)=>{
 if(!user){status.textContent='Please sign in before upgrading.';setTimeout(()=>location.replace('auth.html'),900);return;}
 button.disabled=false;status.textContent='Signed in as '+(user.email||'V2 member');
 button.onclick=()=>{button.disabled=true;status.textContent='Opening secure Stripe checkout…';location.href=`${API}?action=pro-pay&uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`;};
 if(params.get('upgrade')==='cancelled')status.textContent='Payment cancelled. Your account has not been charged.';
});
