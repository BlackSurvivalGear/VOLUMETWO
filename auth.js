import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
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

const routeAfterSignIn = () => window.location.replace('dashboard.html');

if (isSignInPage) {
  const form = document.querySelector('#sign-in-form');
  const createForm = document.querySelector('#create-account-form');
  const googleButton = document.querySelector('#google-sign-in');
  const signInView = document.querySelector('#sign-in-view');
  const createView = document.querySelector('#create-account-view');
  const showCreateButton = document.querySelector('#show-create-account');
  const showSignInButton = document.querySelector('#show-sign-in');
  const title = document.querySelector('#auth-title');
  const kicker = document.querySelector('#auth-kicker');

  const showView = (view) => {
    const creating = view === 'create';
    if (signInView) signInView.hidden = creating;
    if (createView) createView.hidden = !creating;
    if (title) title.textContent = creating ? 'Create your V2 account.' : 'Sign in to V2.';
    if (kicker) kicker.textContent = creating ? 'V2 / 02' : 'V2 / 01';
    setStatus('');
    document.querySelector(creating ? '#new-email' : '#email')?.focus();
  };

  showCreateButton?.addEventListener('click', () => showView('create'));
  showSignInButton?.addEventListener('click', () => showView('signin'));

  onAuthStateChanged(auth, (user) => {
    if (user) routeAfterSignIn();
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

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#new-email').value.trim();
    const password = document.querySelector('#new-password').value;
    const confirmPassword = document.querySelector('#new-password-confirm').value;
    const submitButton = createForm.querySelector('button[type="submit"]');

    if (password.length < 6) {
      setStatus('Please use a password with at least 6 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('The passwords do not match.', 'error');
      return;
    }

    submitButton.disabled = true;
    setStatus('Creating your member account…');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      routeAfterSignIn();
    } catch (error) {
      const messages = {
        'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Please choose a stronger password.'
      };
      setStatus(messages[error.code] || 'Unable to create the account. Please try again.', 'error');
      submitButton.disabled = false;
    }
  });

  googleButton?.addEventListener('click', async () => {
    googleButton.disabled = true;
    setStatus('Opening Google sign-in…');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') setStatus('Google sign-in was not completed. Please try again.', 'error');
      else setStatus('');
      googleButton.disabled = false;
    }
  });
}

const renderSignedInNavigation = () => {
  const desktopNav = document.querySelector('.desktop-nav');
  const mobileNav = document.querySelector('.mobile-nav');
  const html = '<a href="dashboard.html">Dashboard</a><a href="business-tools.html">Business Tools</a><a href="index.html">Public Site</a><button class="nav-sign-out" type="button">Sign Out</button>';
  [desktopNav, mobileNav].forEach((nav) => {
    if (!nav) return;
    nav.innerHTML = html;
    nav.querySelector('.nav-sign-out')?.addEventListener('click', async () => {
      await signOut(auth);
      window.location.replace('index.html');
    });
  });
};

const renderSignedOutNavigation = () => {
  const desktopNav = document.querySelector('.desktop-nav');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!desktopNav || !mobileNav) return;
  const publicHtml = '<a href="index.html">Home</a><a href="about.html">About</a><a href="services.html">Services</a><a href="strategy-day.html">Strategy Day</a><a href="workshops.html">Workshops</a><a href="index.html#contact">Contact</a><a href="auth.html">Sign In</a>';
  desktopNav.innerHTML = publicHtml;
  mobileNav.innerHTML = publicHtml;
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderSignedOutNavigation();
    if (isMemberPage) window.location.replace('auth.html');
    return;
  }
  renderSignedInNavigation();
  const email = document.querySelector('#account-email, #member-email');
  const name = document.querySelector('#account-name, #member-name');
  if (email) email.textContent = user.email || 'Signed-in user';
  if (name) name.textContent = user.displayName || 'V2 Member';
});

if (isMemberPage) {
  document.querySelector('#sign-out')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.replace('index.html');
  });
}
