import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const path = window.location.pathname;
const isHomePage = path.endsWith('/') || path.endsWith('/index.html') || path === '';
const isSignInPage = path.endsWith('/auth.html');
const isAdminPage = path.endsWith('/admin.html');
const isMemberPage = path.endsWith('/dashboard.html') || path.endsWith('/business-tools.html');
const isProtectedPage = isMemberPage || isAdminPage;

const SUPERADMIN_EMAIL = 'admin@lawal.org';
const ROLES = ['member', 'pro', 'admin', 'superadmin'];
const ROLE_LABELS = {
  member: 'Member',
  pro: 'Pro',
  admin: 'Admin',
  superadmin: 'Superadmin'
};

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();
const isSuperadminIdentity = (user) => normaliseEmail(user?.email) === SUPERADMIN_EMAIL;
const isElevatedRole = (role) => role === 'admin' || role === 'superadmin';
const roleLabel = (role) => ROLE_LABELS[role] || ROLE_LABELS.member;

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
  const adminLink = isElevatedRole(role) ? '<a href="admin.html">Admin Dashboard</a>' : '';
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

const getTokenRole = async (user, forceRefresh = false) => {
  const token = await user.getIdTokenResult(forceRefresh);
  const role = token.claims?.role;
  return ROLES.includes(role) ? role : null;
};

const getServerRole = async (user) => {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js");
  const functions = getFunctions(app, 'europe-west1');
  const getMyRole = httpsCallable(functions, 'getMyRole');
  const result = await getMyRole();
  await user.getIdToken(true);
  return ROLES.includes(result.data?.role) ? result.data.role : 'member';
};

const resolveRole = async (user) => {
  // The public site never calls an administrative backend function. It only
  // reads the signed-in token so a normal member can safely browse the site.
  if (!isProtectedPage) {
    return (await getTokenRole(user)) || (isSuperadminIdentity(user) ? 'superadmin' : 'member');
  }

  // Protected pages ask the server for the authoritative role. The server is
  // responsible for bootstrapping new accounts as Member and the designated
  // superadmin identity as Superadmin.
  try {
    return await getServerRole(user);
  } catch {
    const tokenRole = await getTokenRole(user);
    if (tokenRole) return tokenRole;
    return isSuperadminIdentity(user) ? 'superadmin' : 'member';
  }
};

const routeAfterSignIn = () => {
  // There is one entry point for every role. Admins and superadmins receive
  // their separate Admin Dashboard control after the member dashboard loads.
  window.location.replace('dashboard.html');
};

if (isSignInPage) {
  const form = document.querySelector('#sign-in-form');
  const createForm = document.querySelector('#create-account-form');
  const googleButton = document.querySelector('#google-sign-in');

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
      // onAuthStateChanged performs the single dashboard redirect.
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

    if (password !== confirmPassword) {
      setStatus('The passwords do not match.', 'error');
      return;
    }

    submitButton.disabled = true;
    setStatus('Creating your member account…');

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged performs the single dashboard redirect.
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
      // onAuthStateChanged performs the single dashboard redirect.
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
    if (isProtectedPage) window.location.replace('auth.html');
    return;
  }

  const role = await resolveRole(user);
  renderSignedInNavigation(role);

  const accountEmail = document.querySelector('#account-email, #member-email');
  const accountName = document.querySelector('#account-name, #member-name');
  if (accountEmail) accountEmail.textContent = user.email || 'Signed-in user';
  if (accountName) accountName.textContent = user.displayName || 'V2 Member';

  const adminDashboardLink = document.querySelector('[data-admin-dashboard]');
  if (adminDashboardLink) adminDashboardLink.hidden = !isElevatedRole(role);

  if (isAdminPage && !isElevatedRole(role)) {
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

if (isMemberPage || isAdminPage) {
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
