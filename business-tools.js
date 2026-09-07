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
  invoiceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    updateInvoicePreview();
  });
  addItemButton?.addEventListener('click', () => addLineItem('', 1, ''));
  printInvoiceButton?.addEventListener('click', () => {
    updateInvoicePreview();
    window.print();
  });
}

const makeQrCode = () => {
  if (!qrPreview || typeof QRCode === 'undefined') return;
  const content = getValue('qr-content');
  if (!content) return;
  const size = Number.parseInt(document.querySelector('#qr-size')?.value || '240', 10);
  qrPreview.replaceChildren();
  new QRCode(qrPreview, {
    text: content,
    width: size,
    height: size,
    correctLevel: QRCode.CorrectLevel.M
  });
  qrEmpty.hidden = true;

  const qrImage = qrPreview.querySelector('img');
  const qrCanvas = qrPreview.querySelector('canvas');
  const updateDownload = () => {
    let dataUrl = '';
    if (qrImage?.src?.startsWith('data:image')) dataUrl = qrImage.src;
    else if (qrCanvas) dataUrl = qrCanvas.toDataURL('image/png');
    if (dataUrl) {
      qrDownload.href = dataUrl;
      qrDownload.setAttribute('aria-disabled', 'false');
    }
  };
  if (qrImage) {
    qrImage.addEventListener('load', updateDownload, { once: true });
    updateDownload();
  } else {
    updateDownload();
  }
};

qrForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  makeQrCode();
});

document.querySelector('#qr-size')?.addEventListener('change', makeQrCode);
