import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const path = window.location.pathname;
const isHomePage = path.endsWith('/') || path.endsWith('/index.html') || path === '';
const isSignInPage = path.endsWith('/auth.html');
const isAdminPage = path.endsWith('/admin.html');
const isMemberPage = path.endsWith('/dashboard.html') || path.endsWith('/business-tools.html') || isAdminPage;
const SUPERADMIN_EMAIL = 'admin@lawal.org';

const setStatus = (message, type = '') => {
  const status = document.querySelector('#auth-status');
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`.trim();
};

const injectPrivateNavStyles = () => {
  if (document.querySelector('#v2-private-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'v2-private-nav-styles';
  style.textContent = `.desktop-nav .nav-sign-out{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.desktop-nav .nav-sign-out:hover{color:#b58a4b}.desktop-nav a{display:inline-flex!important;align-items:center}.mobile-nav .nav-sign-out{font:inherit;color:inherit;background:none;border:0;padding:0;text-align:left;text-transform:uppercase;letter-spacing:.08em;font-size:13px;cursor:pointer}.mobile-nav .nav-sign-out:hover{color:#b58a4b}`;
  document.head.appendChild(style);
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
    ? '<a href="admin.html">Admin Dashboard</a>'
    : '';
  const html = `<a href="dashboard.html">Dashboard</a><a href="business-tools.html">Business Tools</a>${adminLink}<a href="index.html">Public Site</a><button class="nav-sign-out" type="button">Sign Out</button>`;

  injectPrivateNavStyles();

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

  const homeHref = isHomePage ? '#top' : 'index.html';
  const contactHref = isHomePage ? '#contact' : 'index.html#contact';
  const currentPage = path.endsWith('/about.html') ? 'about.html'
    : path.endsWith('/services.html') ? 'services.html'
    : path.endsWith('/strategy-day.html') ? 'strategy-day.html'
    : path.endsWith('/workshops.html') ? 'workshops.html'
    : '';
  const current = (page) => currentPage === page ? ' aria-current="page"' : '';
  const publicHtml = `<a href="${homeHref}">Home</a><a href="about.html"${current('about.html')}>About</a><a href="services.html"${current('services.html')}>Services</a><a href="strategy-day.html"${current('strategy-day.html')}>Strategy Day</a><a href="workshops.html"${current('workshops.html')}>Workshops</a><a href="${contactHref}">Contact</a><a class="sign-in-link" href="auth.html">Sign In</a>`;

  desktopNav.innerHTML = publicHtml;
  mobileNav.innerHTML = publicHtml;
  delete document.body.dataset.authRole;
};

const resolveRole = async (user) => {
  // The designated superadmin identity is a safe UI fallback when the
  // callable backend is temporarily unavailable. Server-side enforcement
  // remains authoritative for every administrative action.
  if (String(user.email || '').trim().toLowerCase() === SUPERADMIN_EMAIL) {
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js");
      const functions = getFunctions(app, 'europe-west1');
      const getMyRole = httpsCallable(functions, 'getMyRole');
      const result = await getMyRole();
      await user.getIdToken(true);
      return result.data?.role || 'superadmin';
    } catch {
      return 'superadmin';
    }
  }

  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js");
    const functions = getFunctions(app, 'europe-west1');
    const getMyRole = httpsCallable(functions, 'getMyRole');
    const result = await getMyRole();
    await user.getIdToken(true);
    return result.data?.role || 'member';
  } catch {
    const token = await user.getIdTokenResult();
    return token.claims.role || 'member';
  }
};

const routeAfterSignIn = async (user) => {
  await resolveRole(user);
  // All successful sign-ins land in the member dashboard first. Admins and
  // superadmins get a separate Admin Dashboard button from that dashboard.
  window.location.replace('dashboard.html');
};

if (isSignInPage) {
  const form = document.querySelector('#sign-in-form');
  const googleButton = document.querySelector('#google-sign-in');

  onAuthStateChanged(auth, async (user) => {
    if (user) await routeAfterSignIn(user);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    setStatus('Signing you in…');

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await routeAfterSignIn(credential.user);
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
      const credential = await signInWithPopup(auth, googleProvider);
      await routeAfterSignIn(credential.user);
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

  const adminDashboardLink = document.querySelector('[data-admin-dashboard]');
  if (adminDashboardLink) {
    adminDashboardLink.hidden = role !== 'admin' && role !== 'superadmin';
  }

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
