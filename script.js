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

const isMemberPage = window.location.pathname.endsWith('/dashboard.html') || window.location.pathname.endsWith('/business-tools.html');
const addSignInLink = (nav) => {
  if (!nav || nav.querySelector('.sign-in-link')) return;
  const link = document.createElement('a');
  link.className = 'sign-in-link';
  link.href = isMemberPage ? 'dashboard.html' : 'auth.html';
  link.textContent = isMemberPage ? 'Dashboard' : 'Sign In';
  if (isMemberPage) link.setAttribute('aria-current', 'page');
  nav.appendChild(link);
};

addSignInLink(document.querySelector('.desktop-nav'));
addSignInLink(document.querySelector('.mobile-nav'));

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Guided discovery-call assistant. The existing discovery request remains the
// booking fallback while a secure Calendar API endpoint is added server-side.
(() => {
  if (document.querySelector('.v2-discovery-launcher')) return;

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'discovery-assistant.css?v=1';
  document.head.appendChild(css);

  const STORAGE_KEY = 'v2DiscoveryAssistant';
  const bookingUrl = 'https://volumetwo.co.uk/discovery-call-info/';
  const steps = [
    { key: 'name', question: 'Hi. I’m the Volume Two Discovery Assistant. I’ll ask a few quick questions, then help you move to a discovery call.\n\nFirst, what’s your name?', type: 'text', placeholder: 'Your name' },
    { key: 'business', question: (s) => `Thanks, ${firstName(s.name)}. What’s the name of your business or organisation?`, type: 'text', placeholder: 'Business name' },
    { key: 'challenge', question: 'What is the main thing stopping you from achieving your business vision?', type: 'options', options: ['Business roadmap', 'Sales strategy', 'Marketing strategy', 'Social media', 'Brand strategy', 'Something else'] },
    { key: 'help', question: 'What kind of help are you looking for right now?', type: 'options', options: ['Generate more leads', 'Scale and attract bigger clients', 'Improve my brand', 'Sales & marketing support', 'Social media support', 'Strategy and planning'] },
    { key: 'value', question: 'Approximately what is a customer or your service worth to you?', type: 'options', options: ['£100–£1,000', '£1,000–£10,000', '£10,000–£50,000+', 'Still developing pricing'] },
    { key: 'urgency', question: 'How quickly do you need help?', type: 'options', options: ['Urgent', 'Important, but not immediate', 'Finding the right help matters most', 'We are doing well and want to scale'] },
    { key: 'website', question: 'What is your website address? If you do not have one yet, type “none”.', type: 'text', placeholder: 'https://… or none' },
    { key: 'email', question: 'What email address should Volume Two use to contact you?', type: 'email', placeholder: 'you@company.com' },
    { key: 'phone', question: 'Finally, what is the best phone number to reach you on?', type: 'tel', placeholder: 'Phone number' }
  ];

  let state = loadState();
  let typingTimer;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'v2-discovery-launcher';
  launcher.textContent = 'Book a Discovery Call';
  launcher.setAttribute('aria-haspopup', 'dialog');

  const overlay = document.createElement('div');
  overlay.className = 'v2-discovery-overlay';

  const panel = document.createElement('aside');
  panel.className = 'v2-discovery-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Volume Two Discovery Assistant');
  panel.innerHTML = `
    <div class="v2-da-header">
      <div class="v2-da-mark">V2</div>
      <div class="v2-da-title"><strong>Discovery Assistant</strong><span>Volume Two · typically a few minutes</span></div>
      <button class="v2-da-close" type="button" aria-label="Close discovery assistant">×</button>
    </div>
    <div class="v2-da-progress" aria-hidden="true"><span></span></div>
    <div class="v2-da-messages" aria-live="polite"></div>
    <div class="v2-da-controls"></div>`;

  document.body.append(overlay, panel, launcher);

  const messages = panel.querySelector('.v2-da-messages');
  const controls = panel.querySelector('.v2-da-controls');
  const progress = panel.querySelector('.v2-da-progress span');
  const closeButton = panel.querySelector('.v2-da-close');

  function firstName(name = '') { return name.trim().split(/\s+/)[0] || 'there'; }
  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      if (saved && Number.isInteger(saved.step) && saved.answers) return saved;
    } catch (_) {}
    return { step: 0, answers: {}, history: [], complete: false };
  }
  function saveState() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function addMessage(text, who, persist = true) {
    const el = document.createElement('div');
    el.className = `v2-da-message v2-da-${who}`;
    el.textContent = text;
    messages.appendChild(el);
    if (persist) state.history.push({ text, who });
    messages.scrollTop = messages.scrollHeight;
  }
  function showTyping(next) {
    controls.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'v2-da-message v2-da-bot v2-da-typing';
    el.setAttribute('aria-label', 'Assistant is typing');
    el.innerHTML = '<i></i><i></i><i></i>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { el.remove(); next(); }, 650);
  }
  function renderHistory() {
    messages.innerHTML = '';
    state.history.forEach((m) => addMessage(m.text, m.who, false));
  }
  function currentQuestion() {
    const step = steps[state.step];
    return typeof step.question === 'function' ? step.question(state.answers) : step.question;
  }
  function updateProgress() {
    progress.style.width = `${state.complete ? 100 : Math.round((state.step / steps.length) * 100)}%`;
  }
  function askCurrent(withTyping = true) {
    updateProgress();
    if (state.complete || state.step >= steps.length) return showComplete();
    const ask = () => {
      addMessage(currentQuestion(), 'bot');
      saveState();
      renderControls();
    };
    withTyping ? showTyping(ask) : ask();
  }
  function renderControls() {
    const step = steps[state.step];
    controls.innerHTML = '';
    if (step.type === 'options') {
      const wrap = document.createElement('div');
      wrap.className = 'v2-da-options';
      step.options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'v2-da-option';
        button.textContent = option;
        button.addEventListener('click', () => answer(option));
        wrap.appendChild(button);
      });
      controls.appendChild(wrap);
      return;
    }
    const form = document.createElement('form');
    form.className = 'v2-da-form';
    const input = document.createElement('input');
    input.className = 'v2-da-input';
    input.type = step.type;
    input.placeholder = step.placeholder || '';
    input.required = true;
    input.autocomplete = step.key === 'email' ? 'email' : step.key === 'phone' ? 'tel' : step.key === 'name' ? 'name' : 'off';
    const send = document.createElement('button');
    send.className = 'v2-da-send';
    send.type = 'submit';
    send.textContent = 'Send';
    form.append(input, send);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value || !input.checkValidity()) { input.reportValidity(); return; }
      answer(value);
    });
    controls.appendChild(form);
    setTimeout(() => input.focus(), 50);
  }
  function answer(value) {
    const step = steps[state.step];
    state.answers[step.key] = value;
    addMessage(value, 'user');
    state.step += 1;
    saveState();
    if (state.step >= steps.length) {
      state.complete = true;
      saveState();
      showTyping(showComplete);
    } else {
      askCurrent(true);
    }
  }
  function showComplete() {
    updateProgress();
    if (!state.history.some((m) => m.text.startsWith('Thanks — I have enough'))) {
      addMessage(`Thanks — I have enough to prepare your discovery request.\n\nBusiness: ${state.answers.business || 'Not supplied'}\nPriority: ${state.answers.challenge || 'Not supplied'}\nTiming: ${state.answers.urgency || 'Not supplied'}\n\nContinue to the booking request to choose the next step.`, 'bot');
      saveState();
    }
    controls.innerHTML = `
      <div class="v2-da-actions">
        <a class="v2-da-primary" href="${bookingUrl}" target="_blank" rel="noopener">Continue to booking ↗</a>
        <a class="v2-da-secondary" href="mailto:info@volumetwo.co.uk?subject=${encodeURIComponent('Discovery call request — ' + (state.answers.business || state.answers.name || 'Website'))}&body=${encodeURIComponent(summary())}">Email this request</a>
      </div>
      <p class="v2-da-note">Your answers are kept only for this browser session. The existing Volume Two discovery request remains available as the booking fallback.</p>
      <button class="v2-da-reset" type="button">Start again</button>`;
    controls.querySelector('.v2-da-reset').addEventListener('click', reset);
  }
  function summary() {
    return `Discovery call request\n\nName: ${state.answers.name || ''}\nBusiness: ${state.answers.business || ''}\nChallenge: ${state.answers.challenge || ''}\nHelp wanted: ${state.answers.help || ''}\nCustomer/service value: ${state.answers.value || ''}\nUrgency: ${state.answers.urgency || ''}\nWebsite: ${state.answers.website || ''}\nEmail: ${state.answers.email || ''}\nPhone: ${state.answers.phone || ''}`;
  }
  function reset() {
    sessionStorage.removeItem(STORAGE_KEY);
    state = { step: 0, answers: {}, history: [], complete: false };
    renderHistory();
    askCurrent(true);
  }
  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    launcher.setAttribute('aria-expanded', 'true');
    renderHistory();
    if (state.complete) showComplete();
    else if (!state.history.length) askCurrent(true);
    else renderControls();
    closeButton.focus();
  }
  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', openPanel);
  closeButton.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('open')) closePanel(); });

  document.querySelectorAll('a[href="#contact"]').forEach((link) => {
    if (/discovery call/i.test(link.textContent)) {
      link.addEventListener('click', (event) => { event.preventDefault(); openPanel(); });
    }
  });
})();
