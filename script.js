const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');

if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.textContent = open ? 'Close' : 'Menu';
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = 'Menu';
    });
  });
}

const brandMark = document.querySelector('.brand-mark');
if (brandMark) {
  const logo = document.createElement('img');
  logo.className = 'brand-logo';
  logo.src = 'FAVI.png';
  logo.alt = 'Volume Two';
  logo.width = 42;
  logo.height = 42;
  logo.style.width = '42px';
  logo.style.height = '42px';
  logo.style.objectFit = 'contain';
  logo.style.display = 'block';
  brandMark.replaceWith(logo);
}

const isDashboard = window.location.pathname.endsWith('/dashboard.html');
const addSignInLink = (nav) => {
  if (!nav || nav.querySelector('.sign-in-link')) return;
  const link = document.createElement('a');
  link.className = 'sign-in-link';
  link.href = isDashboard ? 'dashboard.html' : 'auth.html';
  link.textContent = isDashboard ? 'Dashboard' : 'Sign In';
  if (isDashboard) link.setAttribute('aria-current', 'page');
  nav.appendChild(link);
};

addSignInLink(document.querySelector('.desktop-nav'));
addSignInLink(document.querySelector('.mobile-nav'));

document.querySelector('#year').textContent = new Date().getFullYear();
