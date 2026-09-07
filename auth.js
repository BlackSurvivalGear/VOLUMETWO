import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, getAdditionalUserInfo, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const isSignInPage = window.location.pathname.endsWith('/auth.html');
const isMemberPage = window.location.pathname.endsWith('/dashboard.html') || window.location.pathname.endsWith('/business-tools.html');
const isAdminPage = window.location.pathname.endsWith('/admin.html');
const ROLE_LABELS = { member: 'Member', pro: 'Pro', admin: 'Admin', superadmin: 'Superadmin' };
const VALID_ROLES = Object.keys(ROLE_LABELS);

const setStatus = (message, type = '') => {
  const status = document.querySelector('#auth-status');
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`.trim();
};

const routeAfterSignIn = () => window.location.replace('dashboard.html');

async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : null;
  if (!existing) {
    const isSuperadmin = (user.email || '').trim().toLowerCase() === 'admin@lawal.org';
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: isSuperadmin ? 'superadmin' : 'member',
      suspended: false,
      createdAt: serverTimestamp(),
      lastSignInAt: serverTimestamp()
    });
    return { role: isSuperadmin ? 'superadmin' : 'member', suspended: false };
  }
  await setDoc(ref, {
    uid: user.uid,
    email: user.email || existing.email || '',
    displayName: user.displayName || existing.displayName || '',
    photoURL: user.photoURL || existing.photoURL || '',
    lastSignInAt: serverTimestamp()
  }, { merge: true });
  return { role: VALID_ROLES.includes(existing.role) ? existing.role : 'member', suspended: existing.suspended === true };
}

async function resolveProfile(user) {
  try { return await ensureUserProfile(user); }
  catch (error) { console.error('Unable to load V2 user profile:', error); return { role: 'member', suspended: false }; }
}

function setRoleUI(role) {
  document.querySelectorAll('[data-auth-role]').forEach((el) => { el.textContent = ROLE_LABELS[role] || 'Member'; });
  document.querySelectorAll('[data-admin-dashboard]').forEach((el) => { el.hidden = !['admin', 'superadmin'].includes(role); });
}

if (isSignInPage) {
  const form = document.querySelector('#sign-in-form');
  const createForm = document.querySelector('#create-account-form');
  const googleButton = document.querySelector('#google-sign-in');
  const googleCreateButton = document.querySelector('#google-create-account');
  const signInView = document.querySelector('#sign-in-view');
  const createAccountView = document.querySelector('#create-account-view');
  const showCreateButton = document.querySelector('#show-create-account');
  const showSignInButton = document.querySelector('#show-sign-in');
  const showView = (view) => { const creating = view === 'create'; signInView?.toggleAttribute('hidden', creating); createAccountView?.toggleAttribute('hidden', !creating); const title = document.querySelector('#auth-title'); if (title) title.textContent = creating ? 'Create your account.' : 'Welcome back.'; setStatus(''); (creating ? document.querySelector('#new-email') : document.querySelector('#email'))?.focus(); };
  showCreateButton?.addEventListener('click', () => showView('create'));
  showSignInButton?.addEventListener('click', () => showView('sign-in'));
  if (new URLSearchParams(window.location.search).get('mode') === 'create') showView('create');
  onAuthStateChanged(auth, (user) => { if (user) routeAfterSignIn(); });
  form?.addEventListener('submit', async (event) => { event.preventDefault(); const email = document.querySelector('#email').value.trim(); const password = document.querySelector('#password').value; const submitButton = form.querySelector('button[type="submit"]'); submitButton.disabled = true; setStatus('Signing you in…'); try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { const messages = { 'auth/invalid-credential': 'The email or password is incorrect.', 'auth/invalid-email': 'Please enter a valid email address.', 'auth/user-disabled': 'This account has been disabled.', 'auth/too-many-requests': 'Too many attempts. Please try again later.' }; setStatus(messages[error.code] || 'Unable to sign you in. Please check your details and try again.', 'error'); submitButton.disabled = false; } });
  createForm?.addEventListener('submit', async (event) => { event.preventDefault(); const email = document.querySelector('#new-email').value.trim(); const password = document.querySelector('#new-password').value; const confirmPassword = document.querySelector('#new-password-confirm').value; const submitButton = createForm.querySelector('button[type="submit"]'); if (password.length < 6) { setStatus('Please use a password with at least 6 characters.', 'error'); return; } if (password !== confirmPassword) { setStatus('The passwords do not match.', 'error'); return; } submitButton.disabled = true; setStatus('Creating your member account…'); try { await createUserWithEmailAndPassword(auth, email, password); setStatus('Member account created. Opening your dashboard…'); } catch (error) { const messages = { 'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.', 'auth/invalid-email': 'Please enter a valid email address.', 'auth/weak-password': 'Please choose a stronger password.' }; setStatus(messages[error.code] || 'Unable to create the account. Please try again.', 'error'); submitButton.disabled = false; } });
  const signInWithGoogle = async (button, creationMode = false) => { button.disabled = true; setStatus(creationMode ? 'Choose the Google account for your new V2 account…' : 'Opening Google sign-in…'); try { const result = await signInWithPopup(auth, googleProvider); if (creationMode) { const additionalInfo = getAdditionalUserInfo(result); if (!additionalInfo?.isNewUser) { await signOut(auth); setStatus('That Google account already has a V2 account. Please use Sign In instead.', 'error'); button.disabled = false; return; } } } catch (error) { if (error.code !== 'auth/popup-closed-by-user') setStatus('Google sign-in was not completed. Please try again.', 'error'); else setStatus(''); button.disabled = false; } };
  googleButton?.addEventListener('click', () => signInWithGoogle(googleButton, false));
  googleCreateButton?.addEventListener('click', () => signInWithGoogle(googleCreateButton, true));
}

const renderSignedInNavigation = (role) => { const desktopNav = document.querySelector('.desktop-nav'); const mobileNav = document.querySelector('.mobile-nav'); const adminLink = ['admin', 'superadmin'].includes(role) ? '<a href="admin.html">Admin Dashboard</a>' : ''; const html = `<a href="dashboard.html">Dashboard</a><a href="business-tools.html">Business Tools</a>${adminLink}<a href="index.html">Public Site</a><button class="nav-sign-out" type="button">Sign Out</button>`; [desktopNav, mobileNav].forEach((nav) => { if (!nav) return; nav.innerHTML = html; nav.querySelector('.nav-sign-out')?.addEventListener('click', async () => { await signOut(auth); window.location.replace('index.html'); }); }); };
const renderSignedOutNavigation = () => { const desktopNav = document.querySelector('.desktop-nav'); const mobileNav = document.querySelector('.mobile-nav'); if (!desktopNav || !mobileNav) return; const publicHtml = '<a href="index.html">Home</a><a href="about.html">About</a><a href="services.html">Services</a><a href="strategy-day.html">Strategy Day</a><a href="workshops.html">Workshops</a><a href="index.html#contact">Contact</a><a href="auth.html">Sign In</a><a class="nav-create-account" href="auth.html?mode=create">Create V2 Account</a>'; desktopNav.innerHTML = publicHtml; mobileNav.innerHTML = publicHtml; };

onAuthStateChanged(auth, async (user) => {
  if (!user) { renderSignedOutNavigation(); setRoleUI('member'); if (isMemberPage || isAdminPage) window.location.replace('auth.html'); return; }
  const profile = await resolveProfile(user);
  if (profile.suspended && (user.email || '').toLowerCase() !== 'admin@lawal.org') { await signOut(auth); if (!isSignInPage) window.location.replace('auth.html'); setStatus('This V2 account is currently suspended. Please contact Volume Two.', 'error'); return; }
  renderSignedInNavigation(profile.role);
  setRoleUI(profile.role);
  const email = document.querySelector('#account-email, #member-email');
  const name = document.querySelector('#account-name, #member-name');
  if (email) email.textContent = user.email || 'Signed-in user';
  if (name) name.textContent = user.displayName || 'V2 Member';
  if (isAdminPage && !['admin','superadmin'].includes(profile.role)) window.location.replace('dashboard.html');
});

if (isMemberPage) document.querySelector('#sign-out')?.addEventListener('click', async () => { await signOut(auth); window.location.replace('index.html'); });
