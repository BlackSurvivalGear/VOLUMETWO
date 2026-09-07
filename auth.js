import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const isSignInPage = window.location.pathname.endsWith('/auth.html');
const isMemberPage = window.location.pathname.endsWith('/dashboard.html') || window.location.pathname.endsWith('/business-tools.html');

const setStatus = (message, type = '') => {
  const status = document.querySelector('#auth-status');
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`.trim();
};

if (isSignInPage) {
  const form = document.querySelector('#sign-in-form');
  const googleButton = document.querySelector('#google-sign-in');

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace('dashboard.html');
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    setStatus('Signing you in…');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.replace('dashboard.html');
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'The email or password is incorrect.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.'
      };
      setStatus(messages[error.code] || 'Unable to sign you in. Please check your details and try again.', 'error');
      submitButton.disabled = false;
    }
  });

  googleButton?.addEventListener('click', async () => {
    googleButton.disabled = true;
    setStatus('Opening Google sign-in…');
    try {
      await signInWithPopup(auth, googleProvider);
      window.location.replace('dashboard.html');
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setStatus('Google sign-in was not completed. Please try again.', 'error');
      } else {
        setStatus('');
      }
      googleButton.disabled = false;
    }
  });
}

if (isMemberPage) {
  const accountEmail = document.querySelector('#account-email, #member-email');
  const accountName = document.querySelector('#account-name, #member-name');
  const signOutButton = document.querySelector('#sign-out');

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('auth.html');
      return;
    }

    if (accountEmail) accountEmail.textContent = user.email || 'Signed-in user';
    if (accountName) accountName.textContent = user.displayName || 'V2 Member';
  });

  signOutButton?.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOut(auth);
      window.location.replace('auth.html');
    } catch {
      signOutButton.disabled = false;
    }
  });
}
