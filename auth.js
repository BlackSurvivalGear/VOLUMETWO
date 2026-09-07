import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const functions = getFunctions(app, 'europe-west1');
const getMyRole = httpsCallable(functions, 'getMyRole');
const googleProvider = new GoogleAuthProvider();
const path = window.location.pathname;
const isSignInPage = path.endsWith('/auth.html');
const isAdminPage = path.endsWith('/admin.html');
const isMemberPage = path.endsWith('/dashboard.html') || path.endsWith('/business-tools.html') || isAdminPage;

const setStatus = (message, type = '') => {
  const status = document.querySelector('#auth-status');
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`.trim();
};

const roleLabel = (role) => role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Member';

const closeMobileNav = () => {
  const mobileNav = document.querySelector('.mobile-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  mobileNav?.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  if (menuToggle) menuToggle.textContent = 'Menu';
};

const renderSignedInNavigation = (role) => {
  const desktopNav = document.querySelector('.desktop-nav');
  const mobileNav = document.querySelector('.mobile-nav');
  const adminLink = role === 'admin' || role === 'superadmin'
    ? '<a href="admin.html">Admin</a>'
    : '';
  const html = `<a href="dashboard.html">Dashboard</a><a href="business-tools.html">Business Tools</a>${adminLink}<a href="index.html">Public Site</a><button class="nav-sign-out" type="button">Sign Out</button>`;

  [desktopNav, mobileNav].forEach((nav) => {
    if (!nav) return;
    nav.innerHTML = html;
    nav.querySelector('.nav-sign-out')?.addEventListener('click', async () => {
      const button = nav.querySelector('.nav-sign-out');
      button.disabled = true;
      try {
        await signOut(auth);
        window.location.replace('index.html');
      } catch {
        button.disabled = false;
      }
    });
  });

  mobileNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileNav));
  mobileNav?.querySelector('.nav-sign-out')?.addEventListener('click', closeMobileNav);
  document.body.dataset.authRole = role;
};

const renderSignedOutNavigation = () => {
  const desktopNav = document.querySelector('.desktop-nav');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!desktopNav || !mobileNav) return;

  const publicLinks = desktopNav.querySelectorAll('a:not(.sign-in-link)');
  const mobileLinks = mobileNav.querySelectorAll('a:not(.sign-in-link)');
  const publicHtml = Array.from(publicLinks).map((link) => link.outerHTML).join('');
  const mobileHtml = Array.from(mobileLinks).map((link) => link.outerHTML).join('');

  if (!desktopNav.querySelector('.sign-in-link')) {
    desktopNav.innerHTML = `${publicHtml}<a class="sign-in-link" href="auth.html">Sign In</a>`;
  }
  if (!mobileNav.querySelector('.sign-in-link')) {
    mobileNav.innerHTML = `${mobileHtml}<a class="sign-in-link" href="auth.html">Sign In</a>`;
  }
  delete document.body.dataset.authRole;
};

const resolveRole = async (user) => {
  try {
    const result = await getMyRole();
    const role = result.data?.role || 'member';
    await user.getIdToken(true);
    return role;
  } catch {
    const token = await user.getIdTokenResult();
    return token.claims.role || 'member';
  }
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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderSignedOutNavigation();
    if (isMemberPage) window.location.replace('auth.html');
    return;
  }

  const role = await resolveRole(user);
  renderSignedInNavigation(role);

  const accountEmail = document.querySelector('#account-email, #member-email');
  const accountName = document.querySelector('#account-name, #member-name');
  if (accountEmail) accountEmail.textContent = user.email || 'Signed-in user';
  if (accountName) accountName.textContent = user.displayName || 'V2 Member';

  if (isAdminPage && role !== 'admin' && role !== 'superadmin') {
    window.location.replace('dashboard.html');
    return;
  }

  document.querySelectorAll('[data-auth-role]').forEach((element) => {
    element.textContent = roleLabel(role);
  });

  document.dispatchEvent(new CustomEvent('v2-auth-ready', {
    detail: { user, role }
  }));
});

if (isMemberPage) {
  document.querySelector('#sign-out')?.addEventListener('click', async (event) => {
    const signOutButton = event.currentTarget;
    signOutButton.disabled = true;
    try {
      await signOut(auth);
      window.location.replace('index.html');
    } catch {
      signOutButton.disabled = false;
    }
  });
}
