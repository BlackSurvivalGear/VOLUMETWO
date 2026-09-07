import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const logoKey = (uid) => `v2_business_logo_${uid}`;
let currentUid = '';
let businessLogo = '';

const invoiceForm = document.querySelector('#invoice-form');
const lineItems = document.querySelector('#line-items');
const addItemButton = document.querySelector('#add-item');
const printInvoiceButton = document.querySelector('#print-invoice');
const qrForm = document.querySelector('#qr-form');
const qrPreview = document.querySelector('#qrcode');
const qrEmpty = document.querySelector('#qr-empty');
const qrDownload = document.querySelector('#qr-download');

const getValue = (id, fallback = '') => document.querySelector(`#${id}`)?.value.trim() || fallback;
const formatMoney = (amount) => `${getValue('currency', '£')}${amount.toFixed(2)}`;
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const setLogoStatus = (message) => {
  document.querySelectorAll('.logo-status').forEach((element) => { element.textContent = message; });
  document.querySelectorAll('.clear-logo').forEach((button) => { button.hidden = !businessLogo; });
};

const renderLogo = () => {
  const previewLogo = document.querySelector('#preview-logo');
  if (previewLogo) {
    previewLogo.hidden = !businessLogo;
    previewLogo.src = businessLogo || '';
  }
  setLogoStatus(businessLogo ? 'Logo saved for this member account and shared across both tools.' : 'No logo uploaded.');
};

const saveLogo = (dataUrl) => {
  businessLogo = dataUrl;
  if (currentUid) localStorage.setItem(logoKey(currentUid), dataUrl);
  renderLogo();
  if (getValue('qr-content')) makeQrCode();
};

const resizeLogo = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
  if (file.size > 2 * 1024 * 1024) return reject(new Error('Please choose a logo smaller than 2MB.'));
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 600 / image.width, 300 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('The selected image could not be read.'));
    image.src = reader.result;
  };
  reader.onerror = () => reject(new Error('The selected image could not be read.'));
  reader.readAsDataURL(file);
});

const handleLogoUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    saveLogo(await resizeLogo(file));
  } catch (error) {
    setLogoStatus(error.message);
  } finally {
    event.target.value = '';
  }
};

document.querySelectorAll('#invoice-logo, #qr-logo').forEach((input) => input.addEventListener('change', handleLogoUpload));
document.querySelectorAll('#invoice-logo-clear, #qr-logo-clear').forEach((button) => button.addEventListener('click', () => {
  businessLogo = '';
  if (currentUid) localStorage.removeItem(logoKey(currentUid));
  renderLogo();
  if (getValue('qr-content')) makeQrCode();
}));

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUid = user.uid;
  businessLogo = localStorage.getItem(logoKey(currentUid)) || '';
  renderLogo();
});

let itemCount = 0;
const addLineItem = (description = '', quantity = 1, rate = '') => {
  itemCount += 1;
  const row = document.createElement('div');
  row.className = 'line-item';
  row.dataset.itemId = itemCount;
  row.innerHTML = `
    <label class="line-description">Description<input class="item-description" type="text" value="${description.replaceAll('"', '&quot;')}" placeholder="Service or product"></label>
    <label>Qty<input class="item-quantity" type="number" min="0" step="0.01" value="${quantity}"></label>
    <label>Rate<input class="item-rate" type="number" min="0" step="0.01" value="${rate}"></label>
    <div><span class="line-amount">${formatMoney(0)}</span></div>
    <button class="remove-item" type="button" aria-label="Remove line item">×</button>
  `;
  lineItems.appendChild(row);
  row.querySelectorAll('input').forEach((input) => input.addEventListener('input', updateInvoicePreview));
  row.querySelector('.remove-item').addEventListener('click', () => {
    row.remove();
    if (!lineItems.children.length) addLineItem();
    updateInvoicePreview();
  });
  updateInvoicePreview();
};

const collectItems = () => [...lineItems.querySelectorAll('.line-item')].map((row) => {
  const description = row.querySelector('.item-description').value.trim() || 'Item';
  const quantity = Number.parseFloat(row.querySelector('.item-quantity').value) || 0;
  const rate = Number.parseFloat(row.querySelector('.item-rate').value) || 0;
  return { description, quantity, rate, amount: quantity * rate, row };
});

function updateInvoicePreview() {
  if (!invoiceForm) return;
  document.querySelector('#preview-business').textContent = getValue('business-name', 'Your Business');
  document.querySelector('#preview-business-address').textContent = getValue('business-address', 'Business address');
  document.querySelector('#preview-business-email').textContent = getValue('business-email', 'you@business.com');
  document.querySelector('#preview-number').textContent = getValue('invoice-number', 'INV-001');
  document.querySelector('#preview-client').textContent = getValue('client-name', 'Client name');
  document.querySelector('#preview-client-address').textContent = getValue('client-address', 'Client address');
  document.querySelector('#preview-client-email').textContent = getValue('client-email', 'client@example.com');
  document.querySelector('#preview-issue').textContent = formatDate(getValue('issue-date'));
  document.querySelector('#preview-due').textContent = formatDate(getValue('due-date'));

  const items = collectItems();
  const tbody = document.querySelector('#preview-items');
  tbody.replaceChildren();
  let subtotal = 0;
  items.forEach((item) => {
    subtotal += item.amount;
    item.row.querySelector('.line-amount').textContent = formatMoney(item.amount);
    const tr = document.createElement('tr');
    [item.description, item.quantity.toString(), formatMoney(item.rate), formatMoney(item.amount)].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  const taxRate = Number.parseFloat(getValue('tax-rate', '0')) || 0;
  const tax = subtotal * (taxRate / 100);
  document.querySelector('#preview-subtotal').textContent = formatMoney(subtotal);
  document.querySelector('#preview-tax').textContent = `${formatMoney(tax)}${taxRate ? ` (${taxRate}%)` : ''}`;
  document.querySelector('#preview-total').textContent = formatMoney(subtotal + tax);
  document.querySelector('#preview-notes').textContent = getValue('invoice-notes', 'Thank you for your business.');
}

const setToday = () => {
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const issueDate = document.querySelector('#issue-date');
  if (issueDate && !issueDate.value) issueDate.value = iso;
};

if (invoiceForm) {
  setToday();
  addLineItem('', 1, '');
  invoiceForm.querySelectorAll('input, textarea, select').forEach((input) => input.addEventListener('input', updateInvoicePreview));
  invoiceForm.addEventListener('submit', (event) => { event.preventDefault(); updateInvoicePreview(); });
  addItemButton?.addEventListener('click', () => addLineItem('', 1, ''));
  printInvoiceButton?.addEventListener('click', () => { updateInvoicePreview(); window.print(); });
}

const socialPlatforms = {
  instagram: { label: 'Instagram username', placeholder: '@yourbusiness', hint: 'Enter your Instagram username. The QR code will point directly to your profile.', build: (value) => `https://instagram.com/${value.replace(/^@/, '')}` },
  facebook: { label: 'Facebook page or username', placeholder: 'yourbusiness', hint: 'Enter your Facebook page username or full page URL.', build: (value) => value.startsWith('http') ? value : `https://facebook.com/${value.replace(/^@/, '')}` },
  x: { label: 'X username', placeholder: '@yourbusiness', hint: 'Enter your X username. The QR code will point directly to your profile.', build: (value) => `https://x.com/${value.replace(/^@/, '')}` },
  linkedin: { label: 'LinkedIn profile or company URL', placeholder: 'https://linkedin.com/company/yourbusiness', hint: 'Paste your LinkedIn profile or company URL.', build: (value) => value.startsWith('http') ? value : `https://linkedin.com/in/${value.replace(/^@/, '')}` },
  tiktok: { label: 'TikTok username', placeholder: '@yourbusiness', hint: 'Enter your TikTok username. The QR code will point directly to your profile.', build: (value) => `https://tiktok.com/@${value.replace(/^@/, '')}` },
  youtube: { label: 'YouTube channel URL or handle', placeholder: '@yourchannel or https://youtube.com/@yourchannel', hint: 'Enter your YouTube handle or paste the complete channel URL.', build: (value) => value.startsWith('http') ? value : `https://youtube.com/@${value.replace(/^@/, '')}` },
  whatsapp: { label: 'WhatsApp number or link', placeholder: '+447842110899 or https://wa.me/447842110899', hint: 'Use an international phone number or paste a WhatsApp link. Include the country code.', build: (value) => value.startsWith('http') ? value : `https://wa.me/${value.replace(/[^0-9]/g, '')}` },
  telegram: { label: 'Telegram username or channel', placeholder: '@yourchannel', hint: 'Enter your Telegram username or channel handle.', build: (value) => value.startsWith('http') ? value : `https://t.me/${value.replace(/^@/, '')}` },
  threads: { label: 'Threads username', placeholder: '@yourbusiness', hint: 'Enter your Threads username. The QR code will point directly to your profile.', build: (value) => `https://threads.net/@${value.replace(/^@/, '')}` },
  custom: { label: 'Destination URL', placeholder: 'https://example.com', hint: 'Paste any website, booking page, payment link or other destination.', build: (value) => value }
};

const socialHandle = document.querySelector('#social-handle');
const socialHandleLabel = document.querySelector('#social-handle-label');
const socialHint = document.querySelector('#social-hint');
let selectedPlatform = 'instagram';

const setSocialPlatform = (platform) => {
  const config = socialPlatforms[platform] || socialPlatforms.custom;
  selectedPlatform = platform;
  document.querySelectorAll('.social-platform').forEach((button) => {
    const active = button.dataset.platform === platform;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (socialHandleLabel) socialHandleLabel.firstChild.textContent = `${config.label}`;
  if (socialHandle) {
    socialHandle.placeholder = config.placeholder;
    socialHandle.type = platform === 'custom' || platform === 'linkedin' || platform === 'facebook' || platform === 'youtube' ? 'url' : 'text';
  }
  if (socialHint) socialHint.textContent = config.hint;
  const value = socialHandle?.value.trim() || '';
  if (value) {
    document.querySelector('#qr-content').value = config.build(value);
  }
};

document.querySelectorAll('.social-platform').forEach((button) => {
  button.addEventListener('click', () => setSocialPlatform(button.dataset.platform));
});

socialHandle?.addEventListener('input', () => {
  const value = socialHandle.value.trim();
  const config = socialPlatforms[selectedPlatform] || socialPlatforms.custom;
  const content = document.querySelector('#qr-content');
  if (content && value) content.value = config.build(value);
  if (content && !value) content.value = '';
});

setSocialPlatform('instagram');

const waitForQrCanvas = () => new Promise((resolve) => {
  const started = performance.now();
  const check = () => {
    const canvas = qrPreview?.querySelector('canvas');
    const image = qrPreview?.querySelector('img');
    if (canvas || image || performance.now() - started > 1000) resolve({ canvas, image });
    else requestAnimationFrame(check);
  };
  check();
});

const makeQrCode = async () => {
  if (!qrPreview || typeof QRCode === 'undefined') return;
  const content = getValue('qr-content');
  if (!content) return;
  const size = Number.parseInt(document.querySelector('#qr-size')?.value || '240', 10);
  qrPreview.replaceChildren();
  new QRCode(qrPreview, { text: content, width: size, height: size, correctLevel: QRCode.CorrectLevel.H });
  const source = await waitForQrCanvas();
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = size;
  sourceCanvas.height = size;
  const context = sourceCanvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  if (source.canvas) context.drawImage(source.canvas, 0, 0, size, size);
  else if (source.image) context.drawImage(source.image, 0, 0, size, size);

  if (businessLogo) {
    const logo = new Image();
    await new Promise((resolve) => { logo.onload = resolve; logo.onerror = resolve; logo.src = businessLogo; });
    if (logo.complete && logo.naturalWidth) {
      const logoSize = Math.round(size * 0.22);
      const pad = Math.round(size * 0.035);
      const boxSize = logoSize + pad * 2;
      const x = Math.round((size - boxSize) / 2);
      const y = x;
      context.fillStyle = '#fff';
      context.fillRect(x, y, boxSize, boxSize);
      const scale = Math.min(logoSize / logo.naturalWidth, logoSize / logo.naturalHeight);
      const width = logo.naturalWidth * scale;
      const height = logo.naturalHeight * scale;
      context.drawImage(logo, x + (boxSize - width) / 2, y + (boxSize - height) / 2, width, height);
    }
  }

  qrPreview.replaceChildren(sourceCanvas);
  qrEmpty.hidden = true;
  qrDownload.href = sourceCanvas.toDataURL('image/png');
  qrDownload.setAttribute('aria-disabled', 'false');
};

qrForm?.addEventListener('submit', (event) => { event.preventDefault(); makeQrCode(); });
document.querySelector('#qr-size')?.addEventListener('change', makeQrCode);

document.querySelectorAll('[data-tool]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tool;
    document.querySelectorAll('.tool-tab').forEach((button) => {
      const active = button === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tool-panel').forEach((panel) => {
      const active = panel.id === `panel-${target}`;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    if (target === 'qr' && getValue('qr-content')) makeQrCode();
  });
});

document.querySelectorAll('.tool-tab').forEach((tab) => tab.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('.tool-tab')];
  const index = tabs.indexOf(tab);
  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}));
